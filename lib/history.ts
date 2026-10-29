"use server";

// NEW FILE — adds a read-only activity history without touching any existing
// code. The log is DERIVED from data the app already stores (tours,
// tour_members, expenses), so no logging had to be wired into existing actions.
// It imports existing modules (authz, admin client, money formatting) but
// changes none of them.

import { AuthError, requireTourMember } from "./authz";
import { createAdminClient } from "./supabase/admin";
import { coercePaisa, formatTaka } from "./money";

export type HistoryKind = "tour_created" | "member_joined" | "expense_added";

export interface HistoryEvent {
  /** ISO timestamp the event happened at. */
  at: string;
  /** Display name of the person who performed the action. */
  actor: string;
  kind: HistoryKind;
  /** One-line summary, e.g. `Recorded "Breakfast" — ৳1,000.00`. */
  summary: string;
  /** Optional supporting detail (participants, payers, role, …). */
  detail?: string;
}

export interface TourHistory {
  tourName: string;
  events: HistoryEvent[];
}

export interface HistoryResult {
  ok: boolean;
  error?: string;
  data?: TourHistory;
}

interface MemberRow {
  user_id: string;
  display_name: string;
  role: "owner" | "leader" | "member";
  joined_at: string;
}

interface ExpenseRow {
  title: string;
  amount_paisa: number | string;
  participant_ids: string[];
  contributions: { user_id: string; amount_paisa: number | string }[];
  created_by: string;
  created_at: string;
  split_mode?: "equal" | "individual" | null;
  expense_shares?: { user_id: string; amount_paisa: number | string }[] | null;
}

/**
 * Build a sequential, timestamped activity log for a tour. Visible to any
 * member of the tour (membership is verified; non-members get a 403).
 */
export async function getTourHistory(tourId: string): Promise<HistoryResult> {
  try {
    await requireTourMember(tourId);
    const admin = createAdminClient();

    const { data: tour } = await admin
      .from("tours")
      .select("name, created_by, created_at")
      .eq("id", tourId)
      .maybeSingle();
    if (!tour) return { ok: false, error: "Tour not found." };

    const { data: memberData } = await admin
      .from("tour_members")
      .select("user_id, display_name, role, joined_at")
      .eq("tour_id", tourId);
    const members = (memberData ?? []) as MemberRow[];
    const nameById = new Map(members.map((m) => [m.user_id, m.display_name]));
    const roleById = new Map(members.map((m) => [m.user_id, m.role]));
    const nameOf = (id: string) => nameById.get(id) ?? "Former member";

    const { data: expenseData } = await admin
      .from("expenses")
      .select(
        "title, amount_paisa, participant_ids, contributions, created_by, created_at, split_mode, expense_shares(user_id, amount_paisa)",
      )
      .eq("tour_id", tourId);
    const expenses = (expenseData ?? []) as ExpenseRow[];

    const events: HistoryEvent[] = [];

    // 1. Tour creation.
    events.push({
      at: tour.created_at,
      actor: nameOf(tour.created_by),
      kind: "tour_created",
      summary: `Created the tour "${tour.name}"`,
      detail: "Became the owner",
    });

    // 2. Members joining (skip the owner's own join — it coincides with
    //    creation above). Show each member's current role.
    for (const m of members) {
      if (m.user_id === tour.created_by) continue;
      const role = roleById.get(m.user_id) ?? "member";
      events.push({
        at: m.joined_at,
        actor: m.display_name,
        kind: "member_joined",
        summary: `${m.display_name} joined the tour`,
        detail: role === "leader" ? "Currently a secondary leader" : "Currently a member",
      });
    }

    // 3. Expenses recorded.
    for (const e of expenses) {
      const amount = coercePaisa(e.amount_paisa);
      const payerSummary = (e.contributions ?? [])
        .map((c) => `${nameOf(c.user_id)} (${formatTaka(coercePaisa(c.amount_paisa))})`)
        .join(", ");
      const individual = e.split_mode === "individual";
      const sharedPart = individual
        ? `Individual bills: ${(e.expense_shares ?? [])
            .map((s) => `${nameOf(s.user_id)} ${formatTaka(coercePaisa(s.amount_paisa))}`)
            .sort()
            .join(", ")}`
        : `${e.participant_ids.length} shared equally`;
      events.push({
        at: e.created_at,
        actor: nameOf(e.created_by),
        kind: "expense_added",
        summary: `Recorded "${e.title}" — ${formatTaka(amount)}`,
        detail: `${sharedPart} · paid by ${payerSummary}`,
      });
    }

    // Deterministic chronological order (oldest first), stable tie-break.
    events.sort((a, b) =>
      a.at < b.at ? -1 : a.at > b.at ? 1 : a.summary < b.summary ? -1 : a.summary > b.summary ? 1 : 0,
    );

    return { ok: true, data: { tourName: tour.name, events } };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    console.error("getTourHistory error:", err);
    return { ok: false, error: "Could not load the history." };
  }
}
