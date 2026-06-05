-- NZX P2: persist the user's chosen debt-payoff strategy on their profile so the Payoff
-- Plan, Insights, and (later) Expenses all read the same method instead of per-browser
-- localStorage. Nullable text — the app treats null/unknown as the default ("avalanche")
-- via resolvePayoffMethod(). Additive + idempotent (expand-contract safe). RLS already
-- restricts profiles to the owner (profiles_update_own), so no policy change is needed.
alter table public.profiles add column if not exists payoff_method text;
