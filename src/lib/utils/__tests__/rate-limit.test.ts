import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, BruteForceProtection } from '../rate-limit';

// ============================================================================
// RateLimiter tests
// ============================================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Basic functionality
  // --------------------------------------------------------------------------

  it('should allow requests within the limit', () => {
    const r1 = limiter.check('ip1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.retryAfterMs).toBe(0);

    const r2 = limiter.check('ip1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('ip1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests exceeding the limit', () => {
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');

    const r4 = limiter.check('ip1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it('should allow requests again after the window expires', () => {
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');

    // Blocked now
    expect(limiter.check('ip1').allowed).toBe(false);

    // Advance past the window (1000ms)
    vi.advanceTimersByTime(1001);

    const result = limiter.check('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Key isolation
  // --------------------------------------------------------------------------

  it('should track different keys independently', () => {
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');

    // ip1 is blocked
    expect(limiter.check('ip1').allowed).toBe(false);

    // ip2 should still be allowed
    const result = limiter.check('ip2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Sliding window
  // --------------------------------------------------------------------------

  it('should use sliding window (not fixed window)', () => {
    // Make 3 requests at t=0
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');

    // Advance 600ms (still within window)
    vi.advanceTimersByTime(600);
    expect(limiter.check('ip1').allowed).toBe(false);

    // Advance another 500ms (total 1100ms — past the first request's window)
    vi.advanceTimersByTime(500);
    const result = limiter.check('ip1');
    expect(result.allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // retryAfterMs
  // --------------------------------------------------------------------------

  it('should return correct retryAfterMs when rate limited', () => {
    const now = Date.now();
    limiter.check('ip1');
    limiter.check('ip1');
    limiter.check('ip1');

    const result = limiter.check('ip1');
    expect(result.allowed).toBe(false);
    // retryAfterMs should be close to windowMs (1000ms)
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000);
  });
});

// ============================================================================
// BruteForceProtection tests
// ============================================================================

describe('BruteForceProtection', () => {
  let bf: BruteForceProtection;

  beforeEach(() => {
    bf = new BruteForceProtection();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Initial state
  // --------------------------------------------------------------------------

  it('should allow first attempt (no history)', () => {
    const result = bf.check('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
    expect(result.lockoutSeconds).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Progressive lockout — first threshold (5 attempts → 30s)
  // --------------------------------------------------------------------------

  it('should lock after 5 failed attempts (30 second lockout)', () => {
    for (let i = 0; i < 5; i++) {
      bf.recordFailure('ip1');
    }

    const result = bf.check('ip1');
    expect(result.allowed).toBe(false);
    expect(result.remainingAttempts).toBe(0);
    expect(result.lockoutSeconds).toBeGreaterThan(0);
    expect(result.lockoutSeconds).toBeLessThanOrEqual(30);
  });

  it('should unlock after 30 second lockout expires', () => {
    for (let i = 0; i < 5; i++) {
      bf.recordFailure('ip1');
    }

    // Still locked
    expect(bf.check('ip1').allowed).toBe(false);

    // Advance past 30 second lockout
    vi.advanceTimersByTime(31_000);

    const result = bf.check('ip1');
    expect(result.allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Progressive lockout — second threshold (10 attempts → 5 min)
  // --------------------------------------------------------------------------

  it('should escalate to 5 minute lockout after 10 failed attempts', () => {
    for (let i = 0; i < 10; i++) {
      bf.recordFailure('ip1');
    }

    const result = bf.check('ip1');
    expect(result.allowed).toBe(false);
    expect(result.lockoutSeconds).toBeGreaterThan(30);
    expect(result.lockoutSeconds).toBeLessThanOrEqual(300);
  });

  // --------------------------------------------------------------------------
  // Progressive lockout — third threshold (15 attempts → 15 min)
  // --------------------------------------------------------------------------

  it('should escalate to 15 minute lockout after 15 failed attempts', () => {
    for (let i = 0; i < 15; i++) {
      bf.recordFailure('ip1');
    }

    const result = bf.check('ip1');
    expect(result.allowed).toBe(false);
    expect(result.lockoutSeconds).toBeGreaterThan(300);
    expect(result.lockoutSeconds).toBeLessThanOrEqual(900);
  });

  // --------------------------------------------------------------------------
  // Reset on success
  // --------------------------------------------------------------------------

  it('should reset all history on successful login', () => {
    for (let i = 0; i < 5; i++) {
      bf.recordFailure('ip1');
    }

    // Currently locked
    expect(bf.check('ip1').allowed).toBe(false);

    // Reset (successful login)
    bf.reset('ip1');

    // Should be fully reset
    const result = bf.check('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
    expect(result.lockoutSeconds).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Key isolation
  // --------------------------------------------------------------------------

  it('should track different keys independently', () => {
    for (let i = 0; i < 5; i++) {
      bf.recordFailure('ip1');
    }

    // ip1 is locked
    expect(bf.check('ip1').allowed).toBe(false);

    // ip2 should be fine
    const result = bf.check('ip2');
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
  });

  // --------------------------------------------------------------------------
  // Remaining attempts countdown
  // --------------------------------------------------------------------------

  it('should count down remaining attempts correctly', () => {
    bf.recordFailure('ip1');
    expect(bf.check('ip1').remainingAttempts).toBe(4);

    bf.recordFailure('ip1');
    expect(bf.check('ip1').remainingAttempts).toBe(3);

    bf.recordFailure('ip1');
    expect(bf.check('ip1').remainingAttempts).toBe(2);

    bf.recordFailure('ip1');
    expect(bf.check('ip1').remainingAttempts).toBe(1);
  });
});
