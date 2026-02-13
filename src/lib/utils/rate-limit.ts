import { NextResponse } from 'next/server';

// ============================================================================
// In-memory Rate Limiter — مناسب لـ 25 مستخدم (بدون Redis)
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// ---------------------------------------------------------------------------
// RateLimiter class — Sliding window
// ---------------------------------------------------------------------------

export class RateLimiter {
  private store = new Map<string, number[]>();
  private config: RateLimitConfig;
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 60_000; // Cleanup every 1 minute

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given key (IP or user ID).
   * Automatically records the request if allowed.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();

    // Periodic cleanup
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanup(now);
    }

    const windowStart = now - this.config.windowMs;
    const timestamps = this.store.get(key) || [];

    // Filter to only timestamps within the current window
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= this.config.maxRequests) {
      // Rate limited
      const oldestInWindow = validTimestamps[0];
      const retryAfterMs = oldestInWindow + this.config.windowMs - now;
      this.store.set(key, validTimestamps);

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
      };
    }

    // Allowed — record this request
    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return {
      allowed: true,
      remaining: this.config.maxRequests - validTimestamps.length,
      retryAfterMs: 0,
    };
  }

  /** Remove expired entries to prevent memory leaks */
  private cleanup(now: number): void {
    const windowStart = now - this.config.windowMs;
    Array.from(this.store.entries()).forEach(([key, timestamps]) => {
      const valid = timestamps.filter((t: number) => t > windowStart);
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, valid);
      }
    });
    this.lastCleanup = now;
  }
}

// ---------------------------------------------------------------------------
// BruteForceProtection — Progressive lockout for login
// ---------------------------------------------------------------------------

interface BruteForceEntry {
  attempts: number;
  timestamps: number[];
  lockedUntil: number | null;
}

interface BruteForceResult {
  allowed: boolean;
  remainingAttempts: number;
  lockoutSeconds: number;
}

export class BruteForceProtection {
  private store = new Map<string, BruteForceEntry>();
  private lastCleanup = Date.now();

  // Progressive lockout thresholds
  private readonly THRESHOLDS = [
    { attempts: 5, windowMs: 5 * 60_000, lockoutMs: 30_000 },      // 5 in 5 min → 30s lock
    { attempts: 10, windowMs: 15 * 60_000, lockoutMs: 5 * 60_000 }, // 10 in 15 min → 5 min lock
    { attempts: 15, windowMs: 30 * 60_000, lockoutMs: 15 * 60_000 }, // 15 in 30 min → 15 min lock
  ];

  /**
   * Check if a login attempt is allowed for the given key.
   * Call this BEFORE attempting authentication.
   */
  check(key: string): BruteForceResult {
    const now = Date.now();

    // Periodic cleanup (every 5 minutes)
    if (now - this.lastCleanup > 5 * 60_000) {
      this.cleanup(now);
    }

    const entry = this.store.get(key);

    if (!entry) {
      return { allowed: true, remainingAttempts: this.THRESHOLDS[0].attempts, lockoutSeconds: 0 };
    }

    // Check if currently locked out
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const lockoutSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, lockoutSeconds };
    }

    // Lockout expired — clear it
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      entry.lockedUntil = null;
    }

    // Count remaining attempts before next threshold
    const remaining = this.THRESHOLDS[0].attempts - entry.timestamps.filter(
      (t) => t > now - this.THRESHOLDS[0].windowMs
    ).length;

    return {
      allowed: true,
      remainingAttempts: Math.max(0, remaining),
      lockoutSeconds: 0,
    };
  }

  /**
   * Record a failed login attempt. Call this AFTER a failed authentication.
   */
  recordFailure(key: string): void {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry) {
      entry = { attempts: 0, timestamps: [], lockedUntil: null };
    }

    entry.attempts++;
    entry.timestamps.push(now);

    // Check thresholds from highest to lowest
    for (let i = this.THRESHOLDS.length - 1; i >= 0; i--) {
      const threshold = this.THRESHOLDS[i];
      const recentAttempts = entry.timestamps.filter(
        (t) => t > now - threshold.windowMs
      ).length;

      if (recentAttempts >= threshold.attempts) {
        entry.lockedUntil = now + threshold.lockoutMs;
        break;
      }
    }

    this.store.set(key, entry);
  }

  /**
   * Reset on successful login. Clears all history for the key.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** Remove old entries to prevent memory leaks */
  private cleanup(now: number): void {
    const maxWindow = 30 * 60_000; // 30 minutes (longest threshold window)
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      const hasRecentActivity = entry.timestamps.some((t: number) => t > now - maxWindow);
      const isLocked = entry.lockedUntil && now < entry.lockedUntil;
      if (!hasRecentActivity && !isLocked) {
        this.store.delete(key);
      }
    });
    this.lastCleanup = now;
  }
}

// ---------------------------------------------------------------------------
// Pre-configured instances (singletons)
// ---------------------------------------------------------------------------

/** Login attempts — 5 requests per minute per IP */
export const loginLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** Password reset — 3 requests per 5 minutes per IP */
export const passwordResetLimiter = new RateLimiter({ maxRequests: 3, windowMs: 5 * 60_000 });

/** Backup export/import — 2 requests per minute per user */
export const backupLimiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });

/** Excel export — 5 requests per minute per user */
export const excelLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });

/** General API — 30 requests per minute per IP */
export const apiGeneralLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** Login brute force protection with progressive lockout */
export const loginBruteForce = new BruteForceProtection();

// ---------------------------------------------------------------------------
// Helper: Standard 429 response
// ---------------------------------------------------------------------------

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    { error: 'عدد الطلبات كثير جداً. يرجى المحاولة بعد قليل.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Helper: Extract client IP from request
// ---------------------------------------------------------------------------

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
