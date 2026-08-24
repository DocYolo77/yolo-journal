import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LessonsLearnedEntryRow, LessonsLearnedKind } from "@/lib/supabase/types";

export type LessonsLearnedEntryInput = {
  title: string | null;
  content: string;
  source_url: string | null;
};

export async function listEntriesByKind(
  kind: LessonsLearnedKind
): Promise<{ data: LessonsLearnedEntryRow[]; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("lessons_learned_entries")
      .select("*")
      .eq("kind", kind)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("listEntriesByKind failed", error);
      return { data: null, error: "Einträge konnten nicht geladen werden." };
    }
    return { data: (data ?? []) as LessonsLearnedEntryRow[], error: null };
  } catch (e) {
    console.error("listEntriesByKind failed", e);
    return { data: null, error: "Einträge konnten nicht geladen werden." };
  }
}

export async function createEntry(
  kind: LessonsLearnedKind,
  input: LessonsLearnedEntryInput
): Promise<{ data: LessonsLearnedEntryRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    // New entries go to the end of the list for this kind.
    const { data: maxRow, error: maxError } = await supabase
      .from("lessons_learned_entries")
      .select("sort_order")
      .eq("kind", kind)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("createEntry: sort_order lookup failed", maxError);
      return { data: null, error: "Eintrag konnte nicht gespeichert werden." };
    }

    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("lessons_learned_entries")
      .insert({
        kind,
        title: input.title,
        content: input.content,
        source_url: input.source_url,
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("createEntry failed", error);
      return { data: null, error: "Eintrag konnte nicht gespeichert werden." };
    }
    return { data: data as LessonsLearnedEntryRow, error: null };
  } catch (e) {
    console.error("createEntry failed", e);
    return { data: null, error: "Eintrag konnte nicht gespeichert werden." };
  }
}

export async function updateEntry(
  id: string,
  input: LessonsLearnedEntryInput
): Promise<{ data: LessonsLearnedEntryRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("lessons_learned_entries")
      .update({ title: input.title, content: input.content, source_url: input.source_url })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("updateEntry failed", error);
      return { data: null, error: "Eintrag konnte nicht gespeichert werden." };
    }
    return { data: data as LessonsLearnedEntryRow, error: null };
  } catch (e) {
    console.error("updateEntry failed", e);
    return { data: null, error: "Eintrag konnte nicht gespeichert werden." };
  }
}

export async function deleteEntry(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("lessons_learned_entries").delete().eq("id", id);
    if (error) {
      console.error("deleteEntry failed", error);
      return { error: "Eintrag konnte nicht gelöscht werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("deleteEntry failed", e);
    return { error: "Eintrag konnte nicht gelöscht werden." };
  }
}

/**
 * Swaps `id`'s sort_order with its immediate neighbor in the given
 * direction, scoped to entries of the same kind. A no-op (not an error)
 * when already at the top/bottom of its list.
 */
export async function moveEntry(id: string, direction: "up" | "down"): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: current, error: currentError } = await supabase
      .from("lessons_learned_entries")
      .select("id, kind, sort_order")
      .eq("id", id)
      .single();

    if (currentError || !current) {
      console.error("moveEntry: current lookup failed", currentError);
      return { error: "Eintrag nicht gefunden." };
    }

    const neighborQuery =
      direction === "up"
        ? supabase
            .from("lessons_learned_entries")
            .select("id, sort_order")
            .eq("kind", current.kind)
            .lt("sort_order", current.sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
        : supabase
            .from("lessons_learned_entries")
            .select("id, sort_order")
            .eq("kind", current.kind)
            .gt("sort_order", current.sort_order)
            .order("sort_order", { ascending: true })
            .limit(1);

    const { data: neighborRows, error: neighborError } = await neighborQuery;
    if (neighborError) {
      console.error("moveEntry: neighbor lookup failed", neighborError);
      return { error: "Eintrag konnte nicht verschoben werden." };
    }

    const neighbor = neighborRows?.[0];
    if (!neighbor) {
      return { error: null }; // already at the boundary
    }

    const [{ error: error1 }, { error: error2 }] = await Promise.all([
      supabase.from("lessons_learned_entries").update({ sort_order: neighbor.sort_order }).eq("id", current.id),
      supabase.from("lessons_learned_entries").update({ sort_order: current.sort_order }).eq("id", neighbor.id),
    ]);

    if (error1 || error2) {
      console.error("moveEntry: swap failed", error1, error2);
      return { error: "Eintrag konnte nicht verschoben werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("moveEntry failed", e);
    return { error: "Eintrag konnte nicht verschoben werden." };
  }
}
