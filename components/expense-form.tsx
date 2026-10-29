"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addExpense, type ManageMember } from "@/lib/actions";
import { parseTakaToPaisa, formatTaka } from "@/lib/money";

interface PayerRow {
  key: number;
  userId: string;
  taka: string;
}

type SplitMode = "equal" | "individual";

/** Parse leniently for live totals: invalid/empty -> null (not an error). */
function tryPaisa(value: string, allowZero = false): number | null {
  try {
    return parseTakaToPaisa(value, { allowZero });
  } catch {
    return null;
  }
}

export function ExpenseForm({
  tourId,
  members,
}: {
  tourId: string;
  members: ManageMember[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [totalTaka, setTotalTaka] = useState("");
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  // Bills are kept per member id so toggling a participant off and on again
  // does not lose what was already typed.
  const [bills, setBills] = useState<Record<string, string>>({});
  const [payers, setPayers] = useState<PayerRow[]>([
    { key: 1, userId: members[0]?.userId ?? "", taka: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const selectedMembers = useMemo(
    () => members.filter((m) => participants.has(m.userId)),
    [members, participants],
  );

  // Individual Bills: every selected participant needs a valid bill (৳0 is
  // allowed) and the total is the sum of those bills — never typed by hand.
  const billsComplete =
    selectedMembers.length > 0 &&
    selectedMembers.every((m) => tryPaisa(bills[m.userId] ?? "", true) !== null);
  const billsTotalPaisa = selectedMembers.reduce(
    (sum, m) => sum + (tryPaisa(bills[m.userId] ?? "", true) ?? 0),
    0,
  );

  const totalPaisa =
    splitMode === "individual"
      ? billsComplete && billsTotalPaisa > 0
        ? billsTotalPaisa
        : null
      : tryPaisa(totalTaka);

  const paidPaisa = useMemo(
    () => payers.reduce((sum, p) => sum + (tryPaisa(p.taka) ?? 0), 0),
    [payers],
  );
  const amountsMatch = totalPaisa !== null && paidPaisa === totalPaisa;
  const canSubmit =
    !busy &&
    title.trim() !== "" &&
    totalPaisa !== null &&
    participants.size > 0 &&
    payers.every((p) => p.userId && tryPaisa(p.taka) !== null) &&
    amountsMatch;

  function toggleParticipant(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updatePayer(key: number, patch: Partial<PayerRow>) {
    setPayers((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addPayerRow() {
    setPayers((prev) => [...prev, { key: Date.now(), userId: members[0]?.userId ?? "", taka: "" }]);
  }

  function removePayerRow(key: number) {
    setPayers((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.key !== key)));
  }

  function reset() {
    setTitle("");
    setTotalTaka("");
    setBills({});
    setParticipants(new Set());
    setPayers([{ key: Date.now(), userId: members[0]?.userId ?? "", taka: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setToast(null);
    const res = await addExpense({
      tourId,
      title,
      splitMode,
      totalTaka: splitMode === "equal" ? totalTaka : undefined,
      participantIds: selectedMembers.map((m) => m.userId),
      bills:
        splitMode === "individual"
          ? selectedMembers.map((m) => ({ userId: m.userId, taka: bills[m.userId] ?? "" }))
          : undefined,
      payers: payers.map((p) => ({ userId: p.userId, taka: p.taka })),
    });
    if (res.ok) {
      setToast({ kind: "ok", msg: "Expense saved." });
      reset();
      router.refresh();
    } else {
      setToast({ kind: "err", msg: res.error ?? "Could not save the expense." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Add expense</h2>

      <label className="block text-sm font-medium text-slate-700">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Breakfast at KFC"
          className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
          required
        />
      </label>

      {/* Split mode */}
      <div className="space-y-1">
        <span className="text-sm font-medium text-slate-700">How is it split?</span>
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["equal", "Equal split"],
              ["individual", "Individual bills"],
            ] as const
          ).map(([mode, label]) => (
            <button
              type="button"
              key={mode}
              aria-pressed={splitMode === mode}
              onClick={() => setSplitMode(mode)}
              className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-medium ${
                splitMode === mode ? "bg-white text-brand shadow-sm" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {splitMode === "equal" && (
        <label className="block text-sm font-medium text-slate-700">
          Total amount (৳)
          <input
            value={totalTaka}
            onChange={(e) => setTotalTaka(e.target.value)}
            inputMode="decimal"
            placeholder="1000.00"
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            required
          />
        </label>
      )}

      {/* Participants */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Who shared this expense?{" "}
            <span className="font-normal text-slate-400">({participants.size} selected)</span>
          </span>
          <div className="flex gap-2 text-xs font-medium text-brand">
            <button type="button" onClick={() => setParticipants(new Set(members.map((m) => m.userId)))}>
              Select all
            </button>
            <button type="button" onClick={() => setParticipants(new Set())} className="text-slate-400">
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = participants.has(m.userId);
            return (
              <button
                type="button"
                key={m.userId}
                onClick={() => toggleParticipant(m.userId)}
                className={`min-h-[40px] max-w-full break-words rounded-full border px-3 py-1 text-left text-sm font-medium ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual bills — one input per selected participant. */}
      {splitMode === "individual" && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Each person&rsquo;s bill (৳)</span>
          {selectedMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400">
              Select who shared this expense first.
            </p>
          ) : (
            selectedMembers.map((m) => {
              const raw = bills[m.userId] ?? "";
              const invalid = raw.trim() !== "" && tryPaisa(raw, true) === null;
              return (
                <div key={m.userId} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm text-slate-700">{m.name}</span>
                  <input
                    value={raw}
                    onChange={(e) => setBills((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="৳"
                    aria-label={`Bill for ${m.name}`}
                    aria-invalid={invalid}
                    className={`min-h-[44px] w-28 shrink-0 rounded-xl border px-3 text-base text-slate-900 ${
                      invalid ? "border-red-400" : "border-slate-300"
                    }`}
                  />
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span>Total (auto)</span>
            <span className="font-semibold tabular-nums">
              {billsComplete ? formatTaka(billsTotalPaisa) : "—"}
            </span>
          </div>
          {selectedMembers.length > 0 && !billsComplete && (
            <p className="text-xs text-red-600">
              Enter a valid amount (max 2 decimals) for every selected person.
            </p>
          )}
          {billsComplete && billsTotalPaisa === 0 && (
            <p className="text-xs text-red-600">The bills must add up to more than ৳0.00.</p>
          )}
        </div>
      )}

      {/* Payers */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Who actually paid?</span>
        {payers.map((p) => (
          <div key={p.key} className="flex gap-2">
            <select
              value={p.userId}
              onChange={(e) => updatePayer(p.key, { userId: e.target.value })}
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-900"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              value={p.taka}
              onChange={(e) => updatePayer(p.key, { taka: e.target.value })}
              inputMode="decimal"
              placeholder="৳"
              className="min-h-[44px] w-24 shrink-0 rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            />
            <button
              type="button"
              onClick={() => removePayerRow(p.key)}
              disabled={payers.length <= 1}
              aria-label="Remove payer"
              className="min-h-[44px] w-11 shrink-0 rounded-xl border border-slate-300 text-slate-500 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addPayerRow} className="text-sm font-medium text-brand">
          + Add payer
        </button>
      </div>

      {/* Totals */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm ${
          amountsMatch ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        <span>
          Paid {formatTaka(paidPaisa)} / Total{" "}
          {totalPaisa === null ? "—" : formatTaka(totalPaisa)}
        </span>
        <span className="font-semibold">{amountsMatch ? "Matches" : "Must match exactly"}</span>
      </div>

      {toast && (
        <p className={`text-sm ${toast.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {toast.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-[48px] w-full rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save Expense"}
      </button>
    </form>
  );
}
