import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PaystubClient } from "@/components/finance/PaystubClient";
import type { PaystubInputs } from "@/lib/paystub/tax";

export const dynamic = "force-dynamic";

export default async function PaystubPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load the user's saved inputs to pre-fill the form. Degrades gracefully if the table
  // (migration 0018) hasn't been applied yet — the client falls back to its defaults.
  let initial: Partial<PaystubInputs> | undefined;
  const { data } = await supabase.from("paystub_inputs").select("inputs").eq("profile_id", user.id).maybeSingle();
  if (data && typeof data.inputs === "object" && data.inputs !== null) {
    initial = data.inputs as Partial<PaystubInputs>;
  }

  return <PaystubClient initial={initial} />;
}
