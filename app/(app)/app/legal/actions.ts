"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/telemetry/capture";
import { CURRENT_LEGAL_VERSION, LEGAL_DOCUMENTS } from "@/lib/legal/version";
import type { AcceptLegalState } from "@/lib/legal/acceptState";

/**
 * Record the signed-in user's acceptance of the current legal version. Writes the denormalized
 * columns on `profiles` (for the fast gate check) and appends an immutable audit row capturing
 * the version + request IP + user-agent as evidence of consent. Idempotent-ish: re-accepting just
 * stamps the current version again and adds another audit row.
 */
export async function acceptLegal(
  _prev: AcceptLegalState,
  formData: FormData,
): Promise<AcceptLegalState> {
  void formData; // no form fields are read — the action derives everything from the session.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Please log in again." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent");

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ accepted_legal_version: CURRENT_LEGAL_VERSION, accepted_legal_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updateError) {
    captureError(updateError, { action: "acceptLegal.update" });
    return { error: "Couldn't record your acceptance. Please try again." };
  }

  // Audit row is best-effort — the gate check relies on the profile columns above, so an audit
  // insert failure shouldn't block the user (but we report it).
  const { error: auditError } = await supabase.from("legal_acceptances").insert({
    profile_id: user.id,
    version: CURRENT_LEGAL_VERSION,
    documents: [...LEGAL_DOCUMENTS],
    ip,
    user_agent: userAgent,
  });
  if (auditError) captureError(auditError, { action: "acceptLegal.audit" });

  revalidatePath("/app");
  return { error: null, ok: true };
}
