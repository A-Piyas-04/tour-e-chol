import Link from "next/link";
import { redirect } from "next/navigation";
import { getTourManageData } from "@/lib/actions";
import { ExpenseForm } from "@/components/expense-form";
import { RecentExpenses } from "@/components/recent-expenses";
import { LeaderControls } from "@/components/leader-controls";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const { tourId } = await params;
  const res = await getTourManageData(tourId);

  if (!res.ok || !res.data) {
    // Not a leader (or no access) — send back to the balances view / home.
    redirect(`/t/${tourId}`);
  }

  const data = res.data;

  return (
    <main className="space-y-6">
      <header className="rounded-[28px] bg-teal-900 p-6 text-white shadow-[0_16px_32px_rgba(15,118,110,0.16)]">
        <Link href={`/t/${tourId}`} className="text-sm font-medium text-teal-100 underline-offset-4 hover:underline">
          ← Balances
        </Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Manage expenses</h1>
        <p className="mt-1 text-sm text-teal-100">{data.tourName}</p>
        <p className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm text-teal-50">
          Share this join PIN: <span className="ml-1 font-mono text-base font-semibold tracking-widest text-white">{data.joinCode}</span>
        </p>
      </header>

      <ExpenseForm tourId={tourId} members={data.members} />

      <RecentExpenses tourId={tourId} expenses={data.expenses} />

      {data.isOwner && <LeaderControls tourId={tourId} members={data.members} />}
    </main>
  );
}
