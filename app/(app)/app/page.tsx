import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/layout/StatCard";

export const dynamic = "force-dynamic";

export default async function AppDashboard() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const greetingName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    (user?.email ? user.email.split("@")[0] : "there");

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
          // dashboard
        </p>
        <h1 className="mt-3 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
          Welcome back, {greetingName}
          <span aria-hidden className="ml-1">
            👋
          </span>
        </h1>
        <p className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
          Real numbers and your payoff schedule land here in v1.1. For now, the shell.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total debt" accentVar="--color-accent-red" value="—" hint="add your debts in v1.1" />
        <StatCard label="Monthly minimums" accentVar="--color-accent-amber" value="—" hint="auto-summed once you add debts" />
        <StatCard label="Payoff date" accentVar="--color-accent-emerald" value="—" hint="snowball or avalanche" />
        <StatCard label="Interest saved" accentVar="--color-accent-blue" value="—" hint="vs. minimums-only" />
      </div>

      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          // coming next
        </p>
        <h2 className="mt-3 font-sans text-xl font-medium text-[var(--color-text-primary)]">
          v1.1 — Debt entry, snowball / avalanche, schedule, basic charts
        </h2>
        <p className="mt-2 max-w-prose text-sm text-[var(--color-text-secondary)]">
          v1.0 ships the shell, auth, and the schema that everything else hangs off of. The
          real product features arrive in the next phase.
        </p>
      </div>
    </div>
  );
}
