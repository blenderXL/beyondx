import { redirect } from "next/navigation";

// The Budget page was folded into the Expenses hub (Phase 5C). Kept as a redirect so existing
// links/bookmarks don't 404; the route file is deleted a release later (expand-contract).
export default function PlannerPage() {
  redirect("/app/expenses");
}
