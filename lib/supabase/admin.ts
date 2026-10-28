import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY admin client using the Supabase secret key. This bypasses RLS,
 * so it must NEVER be imported into client code and the end-user JWT is never
 * attached to it. Every caller must perform its own authorization checks
 * (see lib/authz.ts) before using this client to read or write data.
 *
 * `import "server-only"` makes the build fail if this file is ever pulled into
 * a client bundle.
 */
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the server environment.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
