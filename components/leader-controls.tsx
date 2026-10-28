"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLeaderRole, type ManageMember } from "@/lib/actions";

export function LeaderControls({
  tourId,
  members,
}: {
  tourId: string;
  members: ManageMember[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(userId: string, makeLeader: boolean) {
    setBusyId(userId);
    setError(null);
    const res = await setLeaderRole({ tourId, userId, isLeader: makeLeader });
    if (!res.ok) setError(res.error ?? "Could not update the role.");
    else router.refresh();
    setBusyId(null);
  }

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-800">Leaders</h2>
      <p className="text-xs text-slate-400">
        Only you (the tour creator) can promote members to secondary leader or demote them.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 break-words text-slate-800">
              {m.name}{" "}
              <span className="text-xs capitalize text-slate-400">· {m.role}</span>
            </span>
            {m.role === "owner" ? (
              <span className="shrink-0 text-xs text-slate-400">Creator</span>
            ) : m.role === "leader" ? (
              <button
                type="button"
                onClick={() => toggle(m.userId, false)}
                disabled={busyId === m.userId}
                className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
              >
                Demote
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggle(m.userId, true)}
                disabled={busyId === m.userId}
                className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Make leader
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
