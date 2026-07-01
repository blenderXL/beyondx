import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { LegalConsentGate } from "@/components/legal/LegalConsentGate";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getFlagProvider } from "@/lib/flags/server";
import { CURRENT_LEGAL_VERSION } from "@/lib/legal/version";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // select("*") so a missing accepted_legal_version column (pre-0020) reads as absent rather
  // than erroring — which keeps the gate inert until the migration lands.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const { tier } = await getEntitlements();
  const enabledFlags = await getFlagProvider().allFlags();

  // First-login legal acknowledgment: block the app until the user accepts the current version.
  // The check is inert until migration 0020 adds the column (key absent ⇒ don't gate), so this
  // ships safely before the column exists; once present, an unaccepted (null) value gates.
  const legalColumnPresent = profile != null && "accepted_legal_version" in profile;
  const needsLegalConsent =
    legalColumnPresent &&
    (profile as { accepted_legal_version?: string | null }).accepted_legal_version !== CURRENT_LEGAL_VERSION;

  // The shell is a client component (owns the responsive grid + drawer state); this layout
  // stays a server component so auth/profile/flags resolve on the server.
  return (
    <SidebarProvider>
      <AppShell
        userId={user.id}
        enabledFlags={enabledFlags}
        email={profile?.email ?? user.email ?? null}
        displayName={profile?.display_name ?? null}
        tier={tier}
      >
        {children}
      </AppShell>
      <LegalConsentGate open={needsLegalConsent} />
    </SidebarProvider>
  );
}
