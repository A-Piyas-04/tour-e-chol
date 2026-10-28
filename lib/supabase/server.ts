import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-based Supabase client for the server. Used to read/refresh the signed
 * in user's session and to verify identity via auth.getUser(). It is bound to
 * the publishable key and the request cookies — NOT the admin/secret key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled by proxy/middleware instead.
          }
        },
      },
    },
  );
}
