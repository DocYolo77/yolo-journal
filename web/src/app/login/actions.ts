"use server";

import { redirect } from "next/navigation";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export type LoginFormState = { error: string | null };

// No public sign-up anywhere in this app — this only ever signs in the
// one pre-provisioned account. Supabase itself also has no sign-up UI
// exposed (no client ever calls supabase.auth.signUp).
export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = (formData.get("email") ?? "").toString().trim();
  const password = (formData.get("password") ?? "").toString();

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }

  const supabase = await getSupabaseAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Login fehlgeschlagen. E-Mail oder Passwort falsch." };
  }

  redirect("/");
}

export async function logoutAction(formData: FormData) {
  // Unused but required so this matches the (formData) => Promise<void>
  // signature a plain <form action={...}> expects.
  void formData;

  const supabase = await getSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
