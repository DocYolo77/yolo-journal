import type { ProcessGrade } from "@/lib/supabase/types";

export const PROCESS_GRADES: ProcessGrade[] = ["A", "B", "C", "D", "F"];

export type WeeklyReviewInput = {
  preconditions_note: string | null;
  worked: string | null;
  not_worked: string | null;
  largest_missed_move_comment: string | null;
  continue_doing: string | null;
  improve: string | null;
  eliminate: string | null;
  next_week_changes: string | null;
  process_grade: ProcessGrade | null;
  process_grade_reason: string | null;
};

export type WeeklyReviewFormState = {
  fieldErrors: Partial<Record<string, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyWeeklyReviewFormState: WeeklyReviewFormState = { fieldErrors: {} };

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

type ParseResult =
  | { success: true; data: WeeklyReviewInput }
  | { success: false; fieldErrors: WeeklyReviewFormState["fieldErrors"]; formError?: string };

export function parseWeeklyReviewForm(formData: FormData): ParseResult {
  const fieldErrors: WeeklyReviewFormState["fieldErrors"] = {};

  const preconditionsNote = readString(formData, "preconditionsNote");
  const worked = readString(formData, "worked");
  const notWorked = readString(formData, "notWorked");
  const largestMissedMoveComment = readString(formData, "largestMissedMoveComment");
  const continueDoing = readString(formData, "continueDoing");
  const improve = readString(formData, "improve");
  const eliminate = readString(formData, "eliminate");
  const nextWeekChanges = readString(formData, "nextWeekChanges");
  const processGradeReason = readString(formData, "processGradeReason");

  const rawProcessGrade = readString(formData, "processGrade");
  let processGrade: ProcessGrade | null = null;
  if (rawProcessGrade) {
    if (!PROCESS_GRADES.includes(rawProcessGrade as ProcessGrade)) {
      fieldErrors.processGrade = "Ungültige Process Grade.";
    } else {
      processGrade = rawProcessGrade as ProcessGrade;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      preconditions_note: preconditionsNote || null,
      worked: worked || null,
      not_worked: notWorked || null,
      largest_missed_move_comment: largestMissedMoveComment || null,
      continue_doing: continueDoing || null,
      improve: improve || null,
      eliminate: eliminate || null,
      next_week_changes: nextWeekChanges || null,
      process_grade: processGrade,
      process_grade_reason: processGradeReason || null,
    },
  };
}
