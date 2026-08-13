import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AccountOption = { id: string; name: string };

export async function listActiveAccounts(): Promise<
  { data: AccountOption[]; error: null } | { data: null; error: string }
> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("accounts")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("listActiveAccounts failed", error);
      return { data: null, error: "Accounts konnten nicht geladen werden." };
    }

    return { data, error: null };
  } catch (e) {
    console.error("listActiveAccounts failed", e);
    return { data: null, error: "Accounts konnten nicht geladen werden." };
  }
}
