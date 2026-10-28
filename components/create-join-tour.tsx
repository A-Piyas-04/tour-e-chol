"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTour, joinTour } from "@/lib/actions";

type Mode = "menu" | "create" | "join";

export function CreateJoinTour() {
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "create") return <CreateForm onBack={() => setMode("menu")} />;
  if (mode === "join") return <JoinForm onBack={() => setMode("menu")} />;

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setMode("create")}
        className="min-h-[56px] rounded-2xl bg-brand px-5 py-4 text-left text-base font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        Create a Tour
        <span className="block text-sm font-normal text-teal-50/90">
          Start a new tour and get a join PIN to share.
        </span>
      </button>
      <button
        type="button"
        onClick={() => setMode("join")}
        className="min-h-[56px] rounded-2xl border border-slate-300 bg-white px-5 py-4 text-left text-base font-semibold text-slate-800 shadow-sm active:scale-[0.99]"
      >
        Join a Tour
        <span className="block text-sm font-normal text-slate-500">
          Enter the 8-digit PIN a friend shared with you.
        </span>
      </button>
    </div>
  );
}

function CreateForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createTour({ name, joinCode: pin });
    if (res.ok && res.data) {
      router.push(`/t/${res.data.tourId}/manage`);
    } else {
      setError(res.error ?? "Could not create the tour.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <BackButton onClick={onBack} />
      <label className="text-sm font-medium text-slate-700">
        Tour name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Cox's Bazar Tour"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
          required
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Join PIN (8 digits)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          pattern="[0-9]{8}"
          placeholder="12345678"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl tracking-[0.3em] text-slate-900"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || pin.length !== 8 || name.trim() === ""}
        className="min-h-[48px] rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create Tour"}
      </button>
    </form>
  );
}

function JoinForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await joinTour({ joinCode: pin });
    if (res.ok && res.data) {
      router.push(`/t/${res.data.tourId}`);
    } else {
      setError(res.error ?? "Could not join the tour.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <BackButton onClick={onBack} />
      <label className="text-sm font-medium text-slate-700">
        Join PIN
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          pattern="[0-9]{8}"
          autoFocus
          placeholder="12345678"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl tracking-[0.3em] text-slate-900"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || pin.length !== 8}
        className="min-h-[48px] rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join Tour"}
      </button>
    </form>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="justify-self-start text-sm font-medium text-brand"
    >
      ← Back
    </button>
  );
}
