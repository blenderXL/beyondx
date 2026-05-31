"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/passwordPolicy";
import type { AuthActionState } from "@/lib/auth/authState";

/**
 * All password / MFA / recovery flows run server-side as Server Actions so that:
 *  - failures return a single generic message (no user enumeration / timing leak),
 *  - validation runs on the server (client hints are UX-only, untrusted),
 *  - the session cookie is written by `@supabase/ssr` in a context where cookies
 *    are writable (unlike a Server Component), keeping tokens out of browser JS.
 * OAuth stays client-side because it needs a full-page browser redirect.
 */

/** Only allow same-site absolute paths as a post-auth destination (no open redirect). */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

async function getSiteUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };

  // Step up to the MFA challenge when the user has a verified factor.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/login/verify?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email) return { error: "Enter your email." };
  if (!validatePassword(password).ok) return { error: "Password doesn't meet the requirements." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await getSupabaseServerClient();
  const site = await getSiteUrl();
  // With email confirmations on, Supabase returns an obfuscated success (not an
  // error) for an already-registered address, so the generic message below is
  // safe regardless of whether the email exists.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${site}/callback` },
  });
  if (error) return { error: "Could not complete sign-up. Please try again." };
  return { error: null, ok: true };
}

export async function verifyMfaAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const supabase = await getSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (listError || !totp) return { error: "No authenticator enrolled." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeError || !challenge) return { error: "Invalid code." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { error: "Invalid code." };

  redirect(next);
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = await getSupabaseServerClient();
  const site = await getSiteUrl();
  // Always report generic success — never reveal whether the address has an account.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/callback?next=/reset-password`,
  });
  return { error: null, ok: true };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!validatePassword(password).ok) return { error: "Password doesn't meet the requirements." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not update password. The reset link may have expired." };

  redirect("/app");
}
