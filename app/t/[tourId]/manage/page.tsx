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
    <main className="space-y-5">
      <header className="space-y-1">
        <Link href={`/t/${tourId}`} className="text-sm font-medium text-brand">
          ← Balances
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{data.tourName}</h1>
        <p className="text-sm text-slate-500">
          Join PIN: <span className="font-mono font-semibold tracking-widest">{data.joinCode}</span>
        </p>
      </header>

      <ExpenseForm tourId={tourId} members={data.members} />

      <RecentExpenses tourId={tourId} expenses={data.expenses} />

      {data.isOwner && <LeaderControls tourId={tourId} members={data.members} />}
    </main>
  );
}
