import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getFlagProvider } from "@/lib/flags/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { tier } = await getEntitlements();
  const enabledFlags = await getFlagProvider().allFlags();

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
    </SidebarProvider>
  );
}
