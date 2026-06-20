import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;
const rateMap = new Map<string, { count: number; start: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  // 0. Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || '127.0.0.1';
  if (!rateLimit(ip)) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  // 1. Run i18n routing
  const response = handleI18nRouting(request);

  // 2. Check auth state
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Derive Supabase auth cookie name from project URL
  const supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/(.+)\.supabase\.co/,
  )?.[1];
  const authCookieName = supabaseRef ? `sb-${supabaseRef}-auth-token` : null;

  // ── Password reset flow ──────────────────────────────────────────────────

  const PASSWORD_RESET_TTL = 120; // seconds
  const resetCookie = request.cookies.get("password_reset");
  const inPasswordReset = resetCookie?.value != null;

  // Helper: set cookies to clear both the restriction and auth token
  function clearResetCookies(res: NextResponse): void {
    res.cookies.set("password_reset", "", { path: "/", maxAge: 0 });
    if (authCookieName) {
      res.cookies.set(authCookieName, "", { path: "/", maxAge: 0 });
    }
  }

  // Helper: override auth token TTL to match remaining reset window
  function syncAuthTokenTtl(res: NextResponse, remaining: number): void {
    if (authCookieName && user) {
      const authCookie = request.cookies.get(authCookieName);
      if (authCookie) {
        res.cookies.set(authCookieName, authCookie.value, {
          path: "/",
          maxAge: Math.ceil(remaining),
          sameSite: "lax",
          httpOnly: true,
          secure: true,
        });
      }
    }
  }

  // Check if the reset timer has expired (manual check using stored timestamp)
  if (inPasswordReset) {
    const resetTime = parseInt(resetCookie!.value, 10);
    const elapsed = (Date.now() - resetTime) / 1000;

    if (elapsed >= PASSWORD_RESET_TTL) {
      // Timer expired — destroy both cookies and redirect to login
      const locale = path.startsWith("/ar") ? "ar" : "en";
      const redirect = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
      clearResetCookies(redirect);
      return redirect;
    } else if (!path.includes("/set-password")) {
      // Still within the reset window — restrict to set-password page.
      const locale = path.startsWith("/ar") ? "ar" : "en";
      const redirect = NextResponse.redirect(new URL(`/${locale}/set-password`, request.url));
      syncAuthTokenTtl(redirect, PASSWORD_RESET_TTL - elapsed);
      return redirect;
    }
  }

  // Set password_reset cookie on the very first request with ?code= (PKCE redirect).
  // Value is the current timestamp so the middleware can enforce the 120s window
  // even if the user doesn't make any request within that time.
  if (
    !inPasswordReset
    && path.includes("/set-password")
    && request.nextUrl.searchParams.has("code")
  ) {
    response.cookies.set("password_reset", String(Date.now()), {
      path: "/",
      maxAge: PASSWORD_RESET_TTL,
      sameSite: "lax",
    });
  }

  const isPublicAuthPage =
    path.includes('/login') || path.includes('/set-password') || path.includes('/forgot-password');

  if (!user && !isPublicAuthPage) {
    // If hitting just a bare locale path (e.g. /en or /ar), it's likely a
    // Supabase auth callback fallback — rewrite to set-password instead of
    // redirect, so the URL hash (e.g. #access_token=…) survives to the
    // client-side handler.
    if (/^\/(en|ar)$/.test(path)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${path.slice(1)}/set-password`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && path.includes('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Set security headers
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
