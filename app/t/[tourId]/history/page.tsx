// NEW FILE — standalone activity-history page at /t/[tourId]/history.
// Any tour member can view it; non-members are redirected away.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTourHistory } from "@/lib/history";
import { HistoryView } from "@/components/history-view";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const { tourId } = await params;
  const res = await getTourHistory(tourId);

  if (!res.ok || !res.data) {
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
        <p className="text-sm text-slate-500">Activity history</p>
      </header>

      <HistoryView events={data.events} />
    </main>
  );
}
