"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNickname } from "@/lib/actions";

export function NicknameSetting({ nickname }: { nickname: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    const result = await setNickname(value);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error ?? "Could not save your nickname.");
    }
    setBusy(false);
  }

  return (
    <section aria-label="Nickname" className={editing ? "" : "pl-[60px]"}>
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setDraft(nickname ?? "");
            setError(null);
            setEditing(true);
          }}
          className="text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {nickname ? "Edit nickname" : "Set a nickname"}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(draft);
          }}
          className="space-y-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-800">
            Your nickname
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={40}
              autoFocus
              placeholder="What should your group call you?"
              className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
          <p className="text-xs text-slate-500">Shown to everyone in your tours. Leave blank to use your Google name.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save nickname"}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className="min-h-[44px] text-sm font-medium text-slate-600 disabled:opacity-60">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
