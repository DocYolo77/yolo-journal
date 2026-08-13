import { getSupabaseAdmin } from "@/lib/supabase/server";

export type StrategyOption = { id: string; name: string };

export async function listActiveStrategies(): Promise<
  { data: StrategyOption[]; error: null } | { data: null; error: string }
> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("strategies")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("listActiveStrategies failed", error);
      return { data: null, error: "Strategien konnten nicht geladen werden." };
    }

    return { data, error: null };
  } catch (e) {
    console.error("listActiveStrategies failed", e);
    return { data: null, error: "Strategien konnten nicht geladen werden." };
  }
}
