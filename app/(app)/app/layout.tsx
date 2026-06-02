import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
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

  return (
    <div className="grid h-screen grid-cols-[15rem_1fr] overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar enabledFlags={enabledFlags} />
      <div className="grid grid-rows-[auto_1fr] overflow-hidden">
        <TopBar
          email={profile?.email ?? user.email ?? null}
          displayName={profile?.display_name ?? null}
          tier={tier}
        />
        <main className="overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
