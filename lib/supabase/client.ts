"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Used ONLY for authentication (Google OAuth sign-in
 * and sign-out). It never reads or writes app tables directly — those tables
 * have RLS enabled with no client policies, so the browser cannot touch them.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
