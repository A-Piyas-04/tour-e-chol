"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense, type ManageExpense } from "@/lib/actions";
import { formatTaka } from "@/lib/money";

export function RecentExpenses({
  tourId,
  expenses,
}: {
  tourId: string;
  expenses: ManageExpense[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(expenseId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This recalculates everyone's balances.`)) return;
    setBusyId(expenseId);
    setError(null);
    const res = await deleteExpense({ tourId, expenseId });
    if (!res.ok) setError(res.error ?? "Could not delete the expense.");
    else router.refresh();
    setBusyId(null);
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">Recent expenses</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {expenses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400">
          No expenses yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {e.participantCount} shared · paid by {e.payerSummary} ·{" "}
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums text-slate-800">
                    {formatTaka(e.amountPaisa)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(e.id, e.title)}
                    disabled={busyId === e.id}
                    className="text-xs font-medium text-rose-600 disabled:opacity-50"
                  >
                    {busyId === e.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
