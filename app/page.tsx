import Link from "next/link";
import { requireUser, AuthError } from "@/lib/authz";
import { getMyTours } from "@/lib/actions";
import { APP_DISPLAY_NAME, APP_TAGLINE } from "@/lib/brand";
import { Logo } from "@/components/logo";
import { GoogleSignIn } from "@/components/google-sign-in";
import { CreateJoinTour } from "@/components/create-join-tour";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let user = null;
  try {
    user = await requireUser();
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
  }

  if (!user) {
    return (
      <main className="flex min-h-[80dvh] flex-col justify-center gap-8">
        <header className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-3">
            <Logo className="h-12 w-12 shrink-0" />
            <h1 className="text-3xl font-bold text-brand">{APP_DISPLAY_NAME}</h1>
          </div>
          <p className="text-base text-slate-600">{APP_TAGLINE}</p>
        </header>
        <GoogleSignIn />
      </main>
    );
  }

  const toursRes = await getMyTours();
  const tours = toursRes.ok ? (toursRes.data ?? []) : [];

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-brand">{APP_DISPLAY_NAME}</h1>
            <p className="truncate text-sm text-slate-500">Signed in as {user.name}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <CreateJoinTour />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">My Tours</h2>
        {tours.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            You haven&apos;t joined any tours yet. Create one or join with a PIN.
          </p>
        ) : (
          <ul className="grid gap-2">
            {tours.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${t.id}`}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm active:scale-[0.99]"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">{t.name}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {t.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
