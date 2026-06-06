import { redirect } from "next/navigation";

// Insights was merged into the Debt payoff planner (/app/plans). Kept as a redirect so existing
// links/bookmarks don't 404; the route file is deleted a release later (expand-contract).
export default function InsightsPage() {
  redirect("/app/plans");
}
