"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTourBalances, type TourBalances } from "@/lib/actions";
import { formatTaka } from "@/lib/money";

export function BalanceLists({
  tourId,
  initial,
}: {
  tourId: string;
  initial: TourBalances;
}) {
  const [data, setData] = useState<TourBalances>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    const res = await getTourBalances(tourId);
    if (res.ok && res.data) setData(res.data);
    setRefreshing(false);
    inFlight.current = false;
  }, [tourId]);

  // Refresh when the tab regains focus/visibility and every 20s while visible.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [refresh]);

  const settled = data.give.length === 0 && data.get.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs leading-relaxed text-slate-500">
          Amounts are recorded obligations — the app never moves money.
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {settled ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <p className="text-3xl" aria-hidden="true">🎉</p>
          <p className="mt-2 text-lg font-semibold text-emerald-800">You&apos;re all settled up!</p>
          <p className="mt-1 text-sm text-emerald-700">No one owes you, and you owe no one.</p>
        </div>
      ) : (
        <>
          <Section
            title="Need to Give"
            rows={data.give}
            total={data.totalGive}
            tone="give"
          />
          <Section
            title="Supposed to Get"
            rows={data.get}
            total={data.totalGet}
            tone="get"
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { name: string; paisa: number }[];
  total: number;
  tone: "give" | "get";
}) {
  const accent =
    tone === "give" ? "text-rose-600" : "text-emerald-600";
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400">
          Nothing here.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
            >
              <span className="min-w-0 break-words font-medium text-slate-800">{r.name}</span>
              <span className={`shrink-0 font-semibold tabular-nums ${accent}`}>{formatTaka(r.paisa)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between bg-teal-50/60 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Total</span>
            <span className={`font-bold tabular-nums ${accent}`}>{formatTaka(total)}</span>
          </li>
        </ul>
      )}
    </section>
  );
}
