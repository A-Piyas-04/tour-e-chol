"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireUser,
  requireTourMember,
  requireLeader,
  requireOwner,
} from "./authz";
import { createAdminClient } from "./supabase/admin";
import { parseTakaToPaisa, coercePaisa, MoneyError } from "./money";
import {
  settle,
  buildUserLists,
  type ExpenseInput,
  type Contribution,
} from "./settlement";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

/** Normalize thrown errors into human-readable action results. */
function toResult(err: unknown): ActionResult<never> {
  if (err instanceof AuthError || err instanceof MoneyError) return fail(err.message);
  if (err instanceof z.ZodError) return fail(err.issues[0]?.message ?? "Invalid input.");
  console.error("action error:", err);
  return fail("Something went wrong. Please try again.");
}

// ---------------------------------------------------------------------------
// Tours
// ---------------------------------------------------------------------------

const createTourSchema = z.object({
  name: z.string().trim().min(1, "Tour name is required.").max(60, "Tour name is too long."),
  joinCode: z.string().regex(/^[0-9]{8}$/, "Join PIN must be exactly 8 digits."),
});

export async function createTour(
  input: z.input<typeof createTourSchema>,
): Promise<ActionResult<{ tourId: string }>> {
  try {
    const { name, joinCode } = createTourSchema.parse(input);
    const user = await requireUser();
    const admin = createAdminClient();

    // Reject a PIN already used by another tour.
    const { data: existing } = await admin
      .from("tours")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (existing) return fail("That join PIN is already in use. Choose another.");

    const { data: tour, error: tourErr } = await admin
      .from("tours")
      .insert({ name, join_code: joinCode, created_by: user.id })
      .select("id")
      .single();
    if (tourErr || !tour) return fail("Could not create the tour.");

    // Add the creator as owner; roll back the tour if this fails.
    const { error: memberErr } = await admin.from("tour_members").insert({
      tour_id: tour.id,
      user_id: user.id,
      display_name: user.name,
      role: "owner",
    });
    if (memberErr) {
      await admin.from("tours").delete().eq("id", tour.id);
      return fail("Could not create the tour.");
    }

    revalidatePath("/");
    return ok({ tourId: tour.id });
  } catch (err) {
    return toResult(err);
  }
}

const joinTourSchema = z.object({
  joinCode: z.string().regex(/^[0-9]{8}$/, "Join PIN must be exactly 8 digits."),
});

export async function joinTour(
  input: z.input<typeof joinTourSchema>,
): Promise<ActionResult<{ tourId: string }>> {
  try {
    const { joinCode } = joinTourSchema.parse(input);
    const user = await requireUser();
    const admin = createAdminClient();

    const { data: tour } = await admin
      .from("tours")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!tour) return fail("No tour matches that PIN.");

    // Already a member? Return them to the same tour, no duplicate row.
    const { data: existing } = await admin
      .from("tour_members")
      .select("user_id")
      .eq("tour_id", tour.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from("tour_members").insert({
        tour_id: tour.id,
        user_id: user.id,
        display_name: user.name,
        role: "member",
      });
      if (error) return fail("Could not join the tour.");
    }

    revalidatePath("/");
    return ok({ tourId: tour.id });
  } catch (err) {
    return toResult(err);
  }
}

export interface MyTour {
  id: string;
  name: string;
  role: "owner" | "leader" | "member";
}

export async function getMyTours(): Promise<ActionResult<MyTour[]>> {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tour_members")
      .select("role, tours(id, name, created_at)")
      .eq("user_id", user.id);
    if (error) return fail("Could not load your tours.");

    const tours = (data ?? [])
      .map((row) => {
        const tour = row.tours as unknown as { id: string; name: string; created_at: string };
        return { id: tour.id, name: tour.name, role: row.role as MyTour["role"], created_at: tour.created_at };
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(({ id, name, role }) => ({ id, name, role }));

    return ok(tours);
  } catch (err) {
    return toResult(err);
  }
}

// ---------------------------------------------------------------------------
// Shared loading
// ---------------------------------------------------------------------------

interface MemberRow {
  user_id: string;
  display_name: string;
  role: "owner" | "leader" | "member";
}

interface ExpenseRow {
  id: string;
  title: string;
  amount_paisa: number | string;
  participant_ids: string[];
  contributions: Contribution[];
  created_by: string;
  created_at: string;
}

async function loadMembers(tourId: string): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tour_members")
    .select("user_id, display_name, role")
    .eq("tour_id", tourId);
  if (error) throw new AuthError("Could not load members.", 403);
  return (data ?? []) as MemberRow[];
}

async function loadExpenses(tourId: string): Promise<ExpenseRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("expenses")
    .select("id, title, amount_paisa, participant_ids, contributions, created_by, created_at")
    .eq("tour_id", tourId)
    .order("created_at", { ascending: false });
  if (error) throw new AuthError("Could not load expenses.", 403);
  return (data ?? []) as ExpenseRow[];
}

function toExpenseInputs(rows: ExpenseRow[]): ExpenseInput[] {
  return rows.map((r) => ({
    participant_ids: r.participant_ids,
    amount_paisa: coercePaisa(r.amount_paisa),
    contributions: r.contributions.map((c) => ({
      user_id: c.user_id,
      amount_paisa: coercePaisa(c.amount_paisa),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Balances (any member)
// ---------------------------------------------------------------------------

export interface BalanceRow {
  name: string;
  paisa: number;
}

export interface TourBalances {
  tourName: string;
  userName: string;
  role: "owner" | "leader" | "member";
  give: BalanceRow[];
  get: BalanceRow[];
  totalGive: number;
  totalGet: number;
}

export async function getTourBalances(
  tourId: string,
): Promise<ActionResult<TourBalances>> {
  try {
    const membership = await requireTourMember(tourId);
    const admin = createAdminClient();

    const { data: tour } = await admin
      .from("tours")
      .select("name")
      .eq("id", tourId)
      .maybeSingle();
    if (!tour) return fail("Tour not found.");

    const members = await loadMembers(tourId);
    const nameById = new Map(members.map((m) => [m.user_id, m.display_name]));

    const transfers = settle(toExpenseInputs(await loadExpenses(tourId)));
    const lists = buildUserLists(transfers, membership.id);

    const label = (userId: string) => nameById.get(userId) ?? "Former member";
    return ok({
      tourName: tour.name,
      userName: membership.name,
      role: membership.role,
      give: lists.give.map((r) => ({ name: label(r.userId), paisa: r.paisa })),
      get: lists.get.map((r) => ({ name: label(r.userId), paisa: r.paisa })),
      totalGive: lists.totalGive,
      totalGet: lists.totalGet,
    });
  } catch (err) {
    return toResult(err);
  }
}

// ---------------------------------------------------------------------------
// Manage data (leaders only)
// ---------------------------------------------------------------------------

export interface ManageMember {
  userId: string;
  name: string;
  role: "owner" | "leader" | "member";
}

export interface ManageExpense {
  id: string;
  title: string;
  amountPaisa: number;
  participantCount: number;
  payerSummary: string;
  createdAt: string;
}

export interface TourManageData {
  tourId: string;
  tourName: string;
  joinCode: string;
  isOwner: boolean;
  members: ManageMember[];
  expenses: ManageExpense[];
}

export async function getTourManageData(
  tourId: string,
): Promise<ActionResult<TourManageData>> {
  try {
    const membership = await requireLeader(tourId);
    const admin = createAdminClient();

    const { data: tour } = await admin
      .from("tours")
      .select("name, join_code, created_by")
      .eq("id", tourId)
      .maybeSingle();
    if (!tour) return fail("Tour not found.");

    const isOwner = tour.created_by === membership.id;
    const members = await loadMembers(tourId);
    const nameById = new Map(members.map((m) => [m.user_id, m.display_name]));
    const rows = await loadExpenses(tourId);

    const expenses: ManageExpense[] = rows.map((r) => {
      const contributions = r.contributions ?? [];
      const payerSummary = contributions
        .map((c) => nameById.get(c.user_id) ?? "Former member")
        .join(", ");
      return {
        id: r.id,
        title: r.title,
        amountPaisa: coercePaisa(r.amount_paisa),
        participantCount: r.participant_ids.length,
        payerSummary,
        createdAt: r.created_at,
      };
    });

    return ok({
      tourId,
      tourName: tour.name,
      // Join code is shown only to leaders/owner who can already manage the tour.
      joinCode: tour.join_code,
      isOwner,
      members: members.map((m) => ({ userId: m.user_id, name: m.display_name, role: m.role })),
      expenses,
    });
  } catch (err) {
    return toResult(err);
  }
}

// ---------------------------------------------------------------------------
// Add / delete expense (leaders only)
// ---------------------------------------------------------------------------

const payerSchema = z.object({
  userId: z.string().uuid("Invalid payer."),
  taka: z.string().min(1, "Enter the amount each payer paid."),
});

const addExpenseSchema = z.object({
  tourId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(100, "Title is too long."),
  totalTaka: z.string().min(1, "Total amount is required."),
  participantIds: z.array(z.string().uuid()).min(1, "Select at least one participant."),
  payers: z.array(payerSchema).min(1, "Add at least one payer."),
});

export async function addExpense(
  input: z.input<typeof addExpenseSchema>,
): Promise<ActionResult<{ expenseId: string }>> {
  try {
    const parsed = addExpenseSchema.parse(input);
    const membership = await requireLeader(parsed.tourId);
    const admin = createAdminClient();

    const members = await loadMembers(parsed.tourId);
    const memberIds = new Set(members.map((m) => m.user_id));

    // Participants: unique, all members of this tour.
    const participantIds = parsed.participantIds;
    if (new Set(participantIds).size !== participantIds.length) {
      return fail("Duplicate participants are not allowed.");
    }
    for (const id of participantIds) {
      if (!memberIds.has(id)) return fail("A participant is not a member of this tour.");
    }

    // Total and payer amounts in exact paisa.
    const totalPaisa = parseTakaToPaisa(parsed.totalTaka);

    const contributions: Contribution[] = [];
    const seenPayers = new Set<string>();
    let paidSum = 0;
    for (const payer of parsed.payers) {
      if (!memberIds.has(payer.userId)) return fail("A payer is not a member of this tour.");
      if (seenPayers.has(payer.userId)) return fail("Each payer may appear only once.");
      seenPayers.add(payer.userId);
      const paisa = parseTakaToPaisa(payer.taka); // rejects zero/negative/junk
      contributions.push({ user_id: payer.userId, amount_paisa: paisa });
      paidSum += paisa;
    }

    if (paidSum !== totalPaisa) {
      return fail("The paid total must equal the expense total exactly.");
    }

    const { data, error } = await admin
      .from("expenses")
      .insert({
        tour_id: parsed.tourId,
        title: parsed.title,
        amount_paisa: totalPaisa,
        participant_ids: participantIds,
        contributions,
        created_by: membership.id,
      })
      .select("id")
      .single();
    if (error || !data) return fail("Could not save the expense.");

    revalidatePath(`/t/${parsed.tourId}`);
    revalidatePath(`/t/${parsed.tourId}/manage`);
    return ok({ expenseId: data.id });
  } catch (err) {
    return toResult(err);
  }
}

const deleteExpenseSchema = z.object({
  tourId: z.string().uuid(),
  expenseId: z.string().uuid(),
});

export async function deleteExpense(
  input: z.input<typeof deleteExpenseSchema>,
): Promise<ActionResult> {
  try {
    const { tourId, expenseId } = deleteExpenseSchema.parse(input);
    await requireLeader(tourId);
    const admin = createAdminClient();

    // Scope the delete to BOTH id and tour_id so a leader of tour X can never
    // delete a row belonging to tour Y.
    const { error } = await admin
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("tour_id", tourId);
    if (error) return fail("Could not delete the expense.");

    revalidatePath(`/t/${tourId}`);
    revalidatePath(`/t/${tourId}/manage`);
    return ok();
  } catch (err) {
    return toResult(err);
  }
}

// ---------------------------------------------------------------------------
// Leader management (creator / owner only)
// ---------------------------------------------------------------------------

const setLeaderRoleSchema = z.object({
  tourId: z.string().uuid(),
  userId: z.string().uuid(),
  isLeader: z.boolean(),
});

export async function setLeaderRole(
  input: z.input<typeof setLeaderRoleSchema>,
): Promise<ActionResult> {
  try {
    const { tourId, userId, isLeader } = setLeaderRoleSchema.parse(input);
    // requireOwner checks tours.created_by === auth user; a stored role is
    // never enough to grant this power.
    const owner = await requireOwner(tourId);
    const admin = createAdminClient();

    if (userId === owner.id) return fail("The owner's role cannot be changed.");

    const { data: target } = await admin
      .from("tour_members")
      .select("role")
      .eq("tour_id", tourId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!target) return fail("That member is not in this tour.");
    if (target.role === "owner") return fail("The owner's role cannot be changed.");

    const { error } = await admin
      .from("tour_members")
      .update({ role: isLeader ? "leader" : "member" })
      .eq("tour_id", tourId)
      .eq("user_id", userId);
    if (error) return fail("Could not update the member's role.");

    revalidatePath(`/t/${tourId}/manage`);
    return ok();
  } catch (err) {
    return toResult(err);
  }
}
