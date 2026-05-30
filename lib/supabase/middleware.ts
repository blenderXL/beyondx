import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

type AssuranceLevel = "aal1" | "aal2" | null;

/**
 * Refreshes the Supabase session cookie on every matched request.
 * Also returns the user and the MFA assurance levels so the caller can gate
 * protected routes (and step authenticated-but-not-yet-2FA'd users up).
 * If Supabase env vars are missing (pre-setup state), this becomes a no-op
 * and returns `user: null` so the public surface still renders.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      response,
      user: null as null,
      currentLevel: null as AssuranceLevel,
      nextLevel: null as AssuranceLevel,
    };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Derive MFA assurance only when signed in. `nextLevel === 'aal2'` means the
  // user has a verified factor; if `currentLevel` is still aal1 they owe a code.
  let currentLevel: AssuranceLevel = null;
  let nextLevel: AssuranceLevel = null;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = (aal?.currentLevel as AssuranceLevel) ?? null;
    nextLevel = (aal?.nextLevel as AssuranceLevel) ?? null;
  }

  return { response, user, currentLevel, nextLevel };
}
