import { describe, it, expect } from "vitest";
import {
  computeShares,
  expenseNet,
  settle,
  buildUserLists,
  type ExpenseInput,
} from "./settlement";

// Simple single-letter ids sort lexicographically A < B < ... < J.
const ALL = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function pay(user: string, paisa: number) {
  return { user_id: user, amount_paisa: paisa };
}

const breakfast: ExpenseInput = {
  participant_ids: ALL,
  amount_paisa: 100_000, // ৳1000
  contributions: [pay("A", 100_000)],
};

const ride: ExpenseInput = {
  participant_ids: ["A", "B", "C", "D", "E", "F"],
  amount_paisa: 6_000, // ৳60
  contributions: [pay("B", 6_000)],
};

describe("computeShares", () => {
  it("splits ৳100 among 3 as 33.34 / 33.33 / 33.33 with zero lost paisa (test 4)", () => {
    const shares = computeShares(10_000, ["A", "B", "C"]);
    expect(shares.get("A")).toBe(3334);
    expect(shares.get("B")).toBe(3333);
    expect(shares.get("C")).toBe(3333);
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(10_000);
  });
});

describe("expenseNet", () => {
  it("multi-payer ৳1000: A pays ৳600, B ৳400 (test 3)", () => {
    const e: ExpenseInput = {
      participant_ids: ALL,
      amount_paisa: 100_000,
      contributions: [pay("A", 60_000), pay("B", 40_000)],
    };
    const net = expenseNet(e);
    expect(net.get("A")).toBe(50_000); // +৳500
    expect(net.get("B")).toBe(30_000); // +৳300
    for (const id of ALL.slice(2)) expect(net.get(id)).toBe(-10_000); // −৳100
    expect([...net.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });

  it("payer need not be a participant (test 5)", () => {
    const e: ExpenseInput = {
      participant_ids: ["B", "C"],
      amount_paisa: 10_000,
      contributions: [pay("A", 10_000)],
    };
    const net = expenseNet(e);
    expect(net.get("A")).toBe(10_000);
    expect(net.get("B")).toBe(-5_000);
    expect(net.get("C")).toBe(-5_000);
  });
});

describe("settle — story scenario", () => {
  it("breakfast alone: everyone owes A ৳100, A owes nobody (test 1)", () => {
    const transfers = settle([breakfast]);
    for (const id of ALL.slice(1)) {
      const t = transfers.find((x) => x.from === id && x.to === "A");
      expect(t?.paisa).toBe(10_000);
    }
    expect(transfers.some((t) => t.from === "A")).toBe(false);
  });

  it("breakfast + ride: B owes A ৳90, no separate A→B, absent 4 untouched by ride (test 2)", () => {
    const transfers = settle([breakfast, ride]);

    const bToA = transfers.find((t) => t.from === "B" && t.to === "A");
    expect(bToA?.paisa).toBe(9_000); // ৳90

    // No opposing A → B row.
    expect(transfers.some((t) => t.from === "A" && t.to === "B")).toBe(false);

    // Riders C–F owe only breakfast ৳100 minus ride ৳10 = ... wait: they owe A
    // ৳100 (breakfast) AND B ৳10 (ride). Both remain as separate pairs.
    for (const id of ["C", "D", "E", "F"]) {
      expect(transfers.find((t) => t.from === id && t.to === "A")?.paisa).toBe(10_000);
      expect(transfers.find((t) => t.from === id && t.to === "B")?.paisa).toBe(1_000);
    }
    // Absent riders G–J owe only breakfast ৳100, nothing for the ride.
    for (const id of ["G", "H", "I", "J"]) {
      expect(transfers.find((t) => t.from === id && t.to === "A")?.paisa).toBe(10_000);
      expect(transfers.some((t) => t.from === id && t.to === "B")).toBe(false);
    }

    // B's UI: Need to Give → A → ৳90.00, and gets ৳10 from each of C–F.
    const bLists = buildUserLists(transfers, "B");
    expect(bLists.give).toEqual([{ userId: "A", paisa: 9_000 }]);
    expect(bLists.totalGive).toBe(9_000);
    expect(bLists.get.reduce((s, r) => s + r.paisa, 0)).toBe(4_000);
  });
});

describe("settle — invariants", () => {
  it("two opposing expenses fully cancel a pair (test 6)", () => {
    const e1: ExpenseInput = {
      participant_ids: ["A", "B"],
      amount_paisa: 20_000,
      contributions: [pay("A", 20_000)],
    };
    const e2: ExpenseInput = {
      participant_ids: ["A", "B"],
      amount_paisa: 20_000,
      contributions: [pay("B", 20_000)],
    };
    expect(settle([e1, e2])).toEqual([]);
  });

  it("deleting an expense removes its effect entirely (test 7)", () => {
    const withRide = settle([breakfast, ride]);
    const withoutRide = settle([breakfast]);
    expect(withRide.find((t) => t.from === "B" && t.to === "A")?.paisa).toBe(9_000);
    // After deleting the ride, B is back to owing the full ৳100.
    expect(withoutRide.find((t) => t.from === "B" && t.to === "A")?.paisa).toBe(10_000);
  });

  it("result is independent of expense order (test 8)", () => {
    expect(settle([breakfast, ride])).toEqual(settle([ride, breakfast]));
  });

  it("sum of all gives equals sum of all gets across the tour", () => {
    const transfers = settle([breakfast, ride]);
    let give = 0;
    let get = 0;
    for (const id of ALL) {
      const l = buildUserLists(transfers, id);
      give += l.totalGive;
      get += l.totalGet;
    }
    expect(give).toBe(get);
  });

  it("each member's (get - give) equals their net paid-minus-share across expenses", () => {
    const expenses = [breakfast, ride];
    const transfers = settle(expenses);
    for (const id of ALL) {
      const l = buildUserLists(transfers, id);
      let expected = 0;
      for (const e of expenses) expected += expenseNet(e).get(id) ?? 0;
      expect(l.totalGet - l.totalGive).toBe(expected);
    }
  });
});
