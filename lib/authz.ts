import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getUserNames } from "./display-name";

/**
 * Authorization helpers. These are the ONLY gate protecting app data, because
 * the admin client bypasses RLS. Every server entry point must call the
 * appropriate guard BEFORE touching tour/member/expense data.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message);
  }
}

export interface AuthUser {
  id: string;
  name: string;
  defaultName: string;
  nickname: string | null;
}

export type TourRole = "owner" | "leader" | "member";

export interface Membership extends AuthUser {
  tourId: string;
  role: TourRole;
}

/** Verify a Google-authenticated user from the session cookie. */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AuthError("You must sign in.", 401);
  }
  return { id: user.id, ...getUserNames(user.user_metadata, user.email) };
}

/**
 * Verify the user is a member of the tour. Returns their membership (including
 * role). Throws 403 — never leaking whether the tour exists — if they are not.
 */
export async function requireTourMember(tourId: string): Promise<Membership> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tour_members")
    .select("role")
    .eq("tour_id", tourId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new AuthError("Could not verify membership.", 403);
  if (!data) throw new AuthError("You do not have access to this tour.", 403);

  return { ...user, tourId, role: data.role as TourRole };
}

/** Verify the user is a leader or owner of the tour. */
export async function requireLeader(tourId: string): Promise<Membership> {
  const membership = await requireTourMember(tourId);
  if (membership.role !== "leader" && membership.role !== "owner") {
    throw new AuthError("Only leaders can perform this action.", 403);
  }
  return membership;
}

/**
 * Verify the user is the ORIGINAL creator of the tour. This checks
 * tours.created_by directly — a stored `owner` role is never trusted on its
 * own for leader management.
 */
export async function requireOwner(tourId: string): Promise<Membership> {
  const membership = await requireTourMember(tourId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tours")
    .select("created_by")
    .eq("id", tourId)
    .maybeSingle();

  if (error || !data) throw new AuthError("Tour not found.", 404);
  if (data.created_by !== membership.id) {
    throw new AuthError("Only the tour creator can perform this action.", 403);
  }
  return membership;
}
