// Pure, deterministic settlement math. No I/O, no database, no framework.
//
// The required behaviour is PAIRWISE cancellation, NOT global minimization:
// opposite debts between the same two people cancel, but we never rewrite
// A -> B -> C into A -> C (that would change who directly owes whom).

export interface Contribution {
  user_id: string;
  amount_paisa: number;
}

export type SplitMode = "equal" | "individual";

export interface ExpenseInput {
  /** Unique participants who share the cost (each id appears once). */
  participant_ids: string[];
  /** Total cost of the expense in paisa. */
  amount_paisa: number;
  /** Who actually paid, and how much (sum must equal amount_paisa). */
  contributions: Contribution[];
  /** Defaults to "equal" so existing callers and stored rows are unchanged. */
  split_mode?: SplitMode;
  /**
   * Exact owed share per participant, used only when split_mode is
   * "individual". Each participant must appear exactly once and the amounts
   * must sum to amount_paisa; equal expenses leave this undefined.
   */
  shares?: Contribution[];
}

export interface Transfer {
  from: string;
  to: string;
  paisa: number;
}

export interface UserLists {
  /** Transfers where the user owes someone else. */
  give: { userId: string; paisa: number }[];
  /** Transfers where someone else owes the user. */
  get: { userId: string; paisa: number }[];
  totalGive: number;
  totalGet: number;
}

/**
 * Split an expense total equally among its unique participants with zero lost
 * paisa. The first `remainder` participants (by lexicographic user id) each
 * receive one extra paisa.
 */
export function computeShares(
  amountPaisa: number,
  participantIds: string[],
): Map<string, number> {
  const ids = [...new Set(participantIds)].sort();
  const n = ids.length;
  const shares = new Map<string, number>();
  if (n === 0) return shares;

  const baseShare = Math.floor(amountPaisa / n);
  const remainder = amountPaisa % n;
  ids.forEach((id, i) => {
    shares.set(id, baseShare + (i < remainder ? 1 : 0));
  });
  return shares;
}

/**
 * Owed share per participant for ONE expense, in either mode. Individual
 * Bills uses each participant's own entered bill verbatim (no division);
 * Equal Split keeps the existing deterministic remainder-in-paisa rule.
 */
export function expenseShares(expense: ExpenseInput): Map<string, number> {
  if (expense.split_mode !== "individual") {
    return computeShares(expense.amount_paisa, expense.participant_ids);
  }
  const shares = new Map<string, number>();
  for (const s of expense.shares ?? []) {
    shares.set(s.user_id, (shares.get(s.user_id) ?? 0) + s.amount_paisa);
  }
  return shares;
}

/**
 * Net position of each involved member inside ONE expense:
 *   net = paid - participant share.
 * Positive = creditor (receives), negative = debtor (gives), zero = settled.
 * The sum of all nets is always exactly zero.
 */
export function expenseNet(expense: ExpenseInput): Map<string, number> {
  const net = new Map<string, number>();
  const add = (id: string, delta: number) =>
    net.set(id, (net.get(id) ?? 0) + delta);

  const shares = expenseShares(expense);
  for (const [id, share] of shares) add(id, -share);
  for (const c of expense.contributions) add(c.user_id, c.amount_paisa);

  // Drop exact zeros so downstream code only sees real positions.
  for (const [id, value] of net) if (value === 0) net.delete(id);
  return net;
}

/**
 * Deterministically settle ONE expense into direct debtor -> creditor
 * transfers by greedily matching debtors and creditors in stable id order.
 */
export function expenseTransfers(expense: ExpenseInput): Transfer[] {
  const net = expenseNet(expense);

  const creditors = [...net.entries()]
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, remaining: v }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const debtors = [...net.entries()]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, remaining: -v }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0 && debtor.id !== creditor.id) {
      transfers.push({ from: debtor.id, to: creditor.id, paisa: amount });
    }
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) di++;
    if (creditor.remaining === 0) ci++;
  }
  return transfers;
}

/**
 * Accumulate transfers across ALL expenses, then net opposing transfers
 * between each unordered pair so a pair appears in only one direction.
 * Result order is deterministic and independent of expense order.
 */
export function settle(expenses: ExpenseInput[]): Transfer[] {
  // Directed sums keyed by `${from}\u0000${to}`.
  const directed = new Map<string, number>();
  for (const expense of expenses) {
    for (const t of expenseTransfers(expense)) {
      const key = `${t.from}\u0000${t.to}`;
      directed.set(key, (directed.get(key) ?? 0) + t.paisa);
    }
  }

  const result: Transfer[] = [];
  const handledPairs = new Set<string>();
  for (const key of directed.keys()) {
    const [from, to] = key.split("\u0000");
    const pairKey = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
    if (handledPairs.has(pairKey)) continue;
    handledPairs.add(pairKey);

    const forward = directed.get(`${from}\u0000${to}`) ?? 0;
    const backward = directed.get(`${to}\u0000${from}`) ?? 0;
    if (forward > backward) {
      result.push({ from, to, paisa: forward - backward });
    } else if (backward > forward) {
      result.push({ from: to, to: from, paisa: backward - forward });
    }
    // equal => fully cancelled, no row either direction
  }

  result.sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0,
  );
  return result;
}

/** Build the Need-to-Give / Supposed-to-Get lists for a single user. */
export function buildUserLists(transfers: Transfer[], userId: string): UserLists {
  const give: { userId: string; paisa: number }[] = [];
  const get: { userId: string; paisa: number }[] = [];
  for (const t of transfers) {
    if (t.paisa <= 0) continue;
    if (t.from === userId && t.to !== userId) {
      give.push({ userId: t.to, paisa: t.paisa });
    } else if (t.to === userId && t.from !== userId) {
      get.push({ userId: t.from, paisa: t.paisa });
    }
  }
  give.sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  get.sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  return {
    give,
    get,
    totalGive: give.reduce((s, r) => s + r.paisa, 0),
    totalGet: get.reduce((s, r) => s + r.paisa, 0),
  };
}
