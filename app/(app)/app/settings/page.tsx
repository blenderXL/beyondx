import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { PortfolioControls } from "@/components/settings/PortfolioControls";
import { DangerZone } from "@/components/settings/DangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { tier } = await getEntitlements();

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--color-text-muted)] uppercase">
          // settings
        </p>
        <h1 className="mt-3 font-sans text-3xl leading-tight font-medium text-[var(--color-text-primary)]">
          Account
        </h1>
      </div>
      <dl className="grid gap-2 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 font-mono text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-[var(--color-text-muted)]">Email</dt>
        <dd className="text-[var(--color-text-primary)]">{user?.email}</dd>
        <dt className="text-[var(--color-text-muted)]">User ID</dt>
        <dd className="break-all text-[var(--color-text-primary)]">{user?.id}</dd>
        <dt className="text-[var(--color-text-muted)]">Tier</dt>
        <dd
          className="tracking-[0.18em] uppercase"
          style={{
            color: tier === "pro" ? "var(--color-accent-purple)" : "var(--color-text-primary)",
          }}
        >
          {tier}
        </dd>
      </dl>
      <Link
        href="/app/settings/security"
        className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <ShieldCheck className="size-5 text-[var(--color-accent-emerald)]" aria-hidden />
        <div className="flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
            // security
          </p>
          <p className="mt-1 font-sans text-sm text-[var(--color-text-secondary)]">
            Two-factor authentication and account protection.
          </p>
        </div>
        <ChevronRight className="size-4 text-[var(--color-text-muted)]" aria-hidden />
      </Link>

      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
          // billing
        </p>
        <p className="mt-2 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
          Billing (Lemon Squeezy) is wired up in v1.1. You&apos;ll be able to upgrade to Pro and
          manage your subscription from here.
        </p>
      </div>

      <PortfolioControls />

      {user?.email ? <DangerZone email={user.email} /> : null}
    </div>
  );
}
