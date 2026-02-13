import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { UserRole } from '@/types/database';
import {
  apiGeneralLimiter,
  loginLimiter,
  passwordResetLimiter,
  backupLimiter,
  excelLimiter,
  rateLimitResponse,
  getClientIP,
} from '@/lib/utils/rate-limit';

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/** Routes that do not require authentication. */
const PUBLIC_ROUTES = ['/login', '/offline'];

/** Routes that only admins may access. */
const ADMIN_ROUTES = ['/dashboard', '/employees', '/reports', '/settings', '/admin-tools'];

/** Routes shared between all authenticated roles. */
const SHARED_ROUTES = ['/attendance', '/permissions', '/absence'];

// ---------------------------------------------------------------------------
// API Rate limit map — route-specific limiters
// ---------------------------------------------------------------------------

const API_RATE_LIMITS: Record<string, typeof passwordResetLimiter> = {
  '/api/admin/reset-password': passwordResetLimiter,
  '/api/admin/backup/export': backupLimiter,
  '/api/admin/backup/import': backupLimiter,
  '/api/reports/excel': excelLimiter,
  '/api/auth/login': loginLimiter,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function redirectUrl(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

function landingPathForRole(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'data_entry':
      return '/attendance';
    default:
      return '/login';
  }
}

// ---------------------------------------------------------------------------
// Helper: apply security headers to a response
// ---------------------------------------------------------------------------

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

// ---------------------------------------------------------------------------
// Helper: create a Supabase client scoped to a request for profile queries
// ---------------------------------------------------------------------------

function createMiddlewareSupabaseClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, response };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- API Routes: apply rate limiting only (auth handled in each route) ----
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request);

    // General API rate limit
    const generalCheck = apiGeneralLimiter.check(ip);
    if (!generalCheck.allowed) {
      return applySecurityHeaders(rateLimitResponse(generalCheck.retryAfterMs));
    }

    // Route-specific rate limit
    const specificLimiter = API_RATE_LIMITS[pathname];
    if (specificLimiter) {
      const specificCheck = specificLimiter.check(ip);
      if (!specificCheck.allowed) {
        return applySecurityHeaders(rateLimitResponse(specificCheck.retryAfterMs));
      }
    }

    // Allow API request to proceed (auth handled in route handlers)
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // ---- Refresh the Supabase session (keeps tokens alive) ----
  const { supabaseResponse, user } = await updateSession(request);

  // ---- Public routes: allow always ----
  if (isPublicRoute(pathname)) {
    // If user is already authenticated and hits /login, redirect to their landing page
    if (user && pathname === '/login') {
      const { supabase } = createMiddlewareSupabaseClient(request);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const role = (profile?.role as UserRole) ?? null;
      return redirectUrl(request, landingPathForRole(role));
    }
    return applySecurityHeaders(supabaseResponse);
  }

  // ---- No user -> redirect to login ----
  if (!user) {
    return redirectUrl(request, '/login');
  }

  // ---- Fetch role from profiles table ----
  const { supabase } = createMiddlewareSupabaseClient(request);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (profile?.role as UserRole) ?? null;

  // ---- Root "/" -> redirect based on role ----
  if (pathname === '/') {
    return redirectUrl(request, landingPathForRole(role));
  }

  // ---- Admin-only routes: block data_entry ----
  if (isAdminRoute(pathname) && role !== 'admin') {
    return redirectUrl(request, '/attendance');
  }

  return applySecurityHeaders(supabaseResponse);
}

// ---------------------------------------------------------------------------
// Matcher - include API routes for rate limiting protection
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico   (favicon)
     * - icons/        (PWA icons)
     * - sw.js         (service worker)
     * - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|sw\\.js|manifest\\.json|manifest\\.webmanifest|\\.well-known/).*)',
  ],
};
