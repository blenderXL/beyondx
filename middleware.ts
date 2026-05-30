import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Runs on every matched request:
 *  1. Refresh the Supabase session cookie.
 *  2. Bounce unauthenticated users away from /app/*.
 */
export async function middleware(request: NextRequest) {
  const { response, user, currentLevel, nextLevel } = await updateSupabaseSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = pathname === "/app" || pathname.startsWith("/app/");

  if (isProtected) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Signed in but owes a 2FA code (has a verified factor, still at aal1).
    // The challenge lives at /login/verify (outside /app), so no redirect loop.
    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      const verifyUrl = new URL("/login/verify", request.url);
      verifyUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(verifyUrl);
    }
  }

  return response;
}

export const config = {
  // Skip static assets and image optimization; everything else flows through.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
