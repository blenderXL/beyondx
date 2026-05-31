import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MfaChallenge } from "@/components/auth/MfaChallenge";

export const metadata: Metadata = { title: "Two-factor verification" };
export const dynamic = "force-dynamic";

function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Already verified, or no factor to step up with → send them on.
  if (!aal || aal.currentLevel === "aal2" || aal.nextLevel !== "aal2") {
    redirect(dest);
  }

  return <MfaChallenge next={dest} />;
}
