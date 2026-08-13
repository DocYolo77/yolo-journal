import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-aware Supabase Auth client (anon/publishable key only) for
// Server Components and Server Actions — checks "is someone logged in"
// and performs sign-in/sign-out. Entirely separate from
// getSupabaseAdmin() in ./server.ts (service-role secret), which never
// touches cookies/session state and is what all journal data reads and
// writes still go through.
export async function getSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are
            // read-only — safe to ignore as long as middleware also
            // refreshes the session (see src/middleware.ts).
          }
        },
      },
    }
  );
}
