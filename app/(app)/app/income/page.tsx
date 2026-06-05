import { redirect } from "next/navigation";

// Income management moved into the Expenses hub (Phase 5C). Kept as a redirect so existing
// links/bookmarks don't 404; the route file is deleted a release later (expand-contract).
export default function IncomePage() {
  redirect("/app/expenses");
}
