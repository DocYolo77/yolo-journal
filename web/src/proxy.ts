import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gatekeeper for the entire app (Next.js 16 renamed "Middleware" to
// "Proxy" — same mechanism, see node_modules/next/dist/docs/01-app/
// 01-getting-started/16-proxy.md). Everything except /login and Next.js'
// own static assets requires a signed-in Supabase Auth session — see the
// matcher below. Server Actions are POSTs to the same route as the page
// they belong to, so protecting a page route protects its actions too;
// there is no separate API surface (besides /api/health, deliberately
// not excluded here — it's gated like everything else).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  // getUser() validates the JWT against Supabase, unlike getSession()
  // which only reads the cookie — required here per Supabase's own SSR
  // guidance, since a stale/forged cookie must not pass. Wrapped: a
  // transient failure calling out to Supabase Auth (network blip, cold
  // start) must never crash the whole response — fail closed (send to
  // /login) instead of letting an unhandled rejection break the page.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isLoginRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (user && isLoginRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch (e) {
    console.error("proxy: auth check failed", e);
    if (!isLoginRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
