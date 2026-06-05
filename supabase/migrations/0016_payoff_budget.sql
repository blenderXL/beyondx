-- NZX redesign: persist the user's monthly payoff budget on their profile (alongside
-- payoff_method, 0013) so the Debt payoff planner AND the Dashboard show the SAME payoff
-- date instead of the planner reading per-browser localStorage and the dashboard guessing a
-- representative budget. Nullable numeric — the app falls back to a sensible default when
-- null. Additive + idempotent (expand-contract safe). RLS already restricts profiles to the
-- owner (profiles_update_own), so no policy change is needed.
alter table public.profiles add column if not exists payoff_budget numeric(14,2);
