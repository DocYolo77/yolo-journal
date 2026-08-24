"use server";

import { revalidatePath } from "next/cache";
import { createEntry, deleteEntry, moveEntry, updateEntry, type LessonsLearnedEntryInput } from "@/lib/data/lessons-learned";
import type { LessonsLearnedEntryRow, LessonsLearnedKind } from "@/lib/supabase/types";

// Plain async Server Actions invoked directly from client onClick
// handlers (not via <form action>) — a card list's add/edit/delete/move
// interactions don't need useActionState's pending/error plumbing per
// action, and this avoids the nested-<form>-inside-<form> class of bug
// that hit the Daily Review's manual ticker add earlier in this project.

export async function createEntryAction(
  kind: LessonsLearnedKind,
  input: LessonsLearnedEntryInput
): Promise<{ data: LessonsLearnedEntryRow | null; error: string | null }> {
  const result = await createEntry(kind, input);
  revalidatePath("/lessons-learned");
  return result;
}

export async function updateEntryAction(
  id: string,
  input: LessonsLearnedEntryInput
): Promise<{ data: LessonsLearnedEntryRow | null; error: string | null }> {
  const result = await updateEntry(id, input);
  revalidatePath("/lessons-learned");
  return result;
}

export async function deleteEntryAction(id: string): Promise<{ error: string | null }> {
  const result = await deleteEntry(id);
  revalidatePath("/lessons-learned");
  return result;
}

export async function moveEntryAction(id: string, direction: "up" | "down"): Promise<{ error: string | null }> {
  const result = await moveEntry(id, direction);
  revalidatePath("/lessons-learned");
  return result;
}
