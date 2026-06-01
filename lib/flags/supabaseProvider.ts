import { getSupabaseServerClient } from "@/lib/supabase/server";
import { FLAG_KEYS, flagDefault, type FlagKey } from "./registry";
import { resolveFlagRow, type FlagProvider } from "./provider";

/**
 * Interim runtime backend: reads the `feature_flags` table (public-read RLS). Flags
 * are flipped from the Supabase dashboard at release sign-off — no redeploy. Every
 * path fails safe to the registry default (usually OFF) on missing row or query error,
 * so a flag is never accidentally exposed because the DB hiccuped.
 */
export class SupabaseFlagProvider implements FlagProvider {
  readonly name = "supabase";

  async isEnabled(key: FlagKey): Promise<boolean> {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", key)
        .maybeSingle();
      if (error) return flagDefault(key);
      return resolveFlagRow(key, data);
    } catch {
      return flagDefault(key);
    }
  }

  async allFlags(): Promise<Record<FlagKey, boolean>> {
    const out = {} as Record<FlagKey, boolean>;
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.from("feature_flags").select("key, enabled");
      const rows = new Map((data ?? []).map((r) => [r.key as string, { enabled: r.enabled as boolean }]));
      for (const key of FLAG_KEYS) {
        out[key] = error ? flagDefault(key) : resolveFlagRow(key, rows.get(key) ?? null);
      }
    } catch {
      for (const key of FLAG_KEYS) out[key] = flagDefault(key);
    }
    return out;
  }
}
