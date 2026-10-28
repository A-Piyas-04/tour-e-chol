"use client";

// NEW FILE — the "click a button to reveal a structured, sequential log" UI.
// Receives the already-fetched events and toggles their visibility. Light
// themed to match the rest of the app.

import { useState } from "react";
import type { HistoryEvent, HistoryKind } from "@/lib/history";

const KIND_LABEL: Record<HistoryKind, string> = {
  tour_created: "Tour created",
  member_joined: "Member joined",
  expense_added: "Expense recorded",
};

const KIND_DOT: Record<HistoryKind, string> = {
  tour_created: "bg-brand",
  member_joined: "bg-sky-500",
  expense_added: "bg-amber-500",
};

export function HistoryView({ events }: { events: HistoryEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-[48px] w-full rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white active:scale-[0.99]"
      >
        {open ? "Hide activity history" : `Show activity history (${events.length})`}
      </button>

      {open &&
        (events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
            Nothing has happened in this tour yet.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-5">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative">
                <span
                  className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ${KIND_DOT[e.kind]}`}
                  aria-hidden="true"
                />
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {KIND_LABEL[e.kind]}
                    </span>
                    <time className="text-xs tabular-nums text-slate-400">
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 font-medium text-slate-800">{e.summary}</p>
                  {e.detail && <p className="text-sm text-slate-500">{e.detail}</p>}
                  <p className="mt-1 text-xs text-slate-400">by {e.actor}</p>
                </div>
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
