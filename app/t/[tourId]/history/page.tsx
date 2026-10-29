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
    <main className="space-y-6">
      <header className="rounded-[28px] bg-teal-900 p-6 text-white shadow-[0_16px_32px_rgba(15,118,110,0.16)]">
        <Link href={`/t/${tourId}`} className="text-sm font-medium text-teal-100 underline-offset-4 hover:underline">
          ← Balances
        </Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Activity history</h1>
        <p className="mt-1 text-sm text-teal-100">{data.tourName}</p>
      </header>

      <HistoryView events={data.events} />
    </main>
  );
}
