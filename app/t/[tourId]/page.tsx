import Link from "next/link";
import { redirect } from "next/navigation";
import { getTourBalances } from "@/lib/actions";
import { BalanceLists } from "@/components/balance-lists";

export const dynamic = "force-dynamic";

export default async function TourPage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const { tourId } = await params;
  const res = await getTourBalances(tourId);

  if (!res.ok || !res.data) {
    // Not a member (or tour missing) — never leak whether it exists.
    redirect("/");
  }

  const data = res.data;
  const isLeader = data.role === "leader" || data.role === "owner";

  return (
    <main className="space-y-6">
      <header className="rounded-[28px] bg-teal-900 p-6 text-white shadow-[0_16px_32px_rgba(15,118,110,0.16)]">
        <Link href="/" className="text-sm font-medium text-teal-100 underline-offset-4 hover:underline">
          ← All tours
        </Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{data.tourName}</h1>
        <p className="mt-1 text-sm text-teal-100">Your shared expenses, at a glance.</p>
        <p className="mt-4 border-t border-white/20 pt-3 text-xs text-teal-100">Viewing as {data.userName}</p>
      </header>

      <nav className="grid grid-cols-2 gap-3" aria-label="Tour pages">
        {isLeader && (
          <Link href={`/t/${tourId}/manage`} className="flex min-h-[52px] items-center justify-center rounded-2xl bg-brand px-3 text-center text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99]">
            Manage expenses
          </Link>
        )}
        <Link href={`/t/${tourId}/history`} className={`flex min-h-[52px] items-center justify-center rounded-2xl border border-teal-200 bg-white px-3 text-center text-sm font-semibold text-brand shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99] ${isLeader ? "" : "col-span-2"}`}>
          Activity history
        </Link>
      </nav>

      <BalanceLists tourId={tourId} initial={data} />
    </main>
  );
}
