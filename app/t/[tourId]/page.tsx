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
    <main className="space-y-5">
      <header className="space-y-1">
        <Link href="/" className="text-sm font-medium text-brand">
          ← All tours
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{data.tourName}</h1>
        <p className="text-sm text-slate-500">{data.userName}</p>
      </header>

      {isLeader && (
        <Link
          href={`/t/${tourId}/manage`}
          className="flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
        >
          Manage expenses
        </Link>
      )}

      <BalanceLists tourId={tourId} initial={data} />
    </main>
  );
}
