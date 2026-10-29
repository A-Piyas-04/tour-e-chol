import Link from "next/link";
import { requireUser, AuthError } from "@/lib/authz";
import { getMyTours } from "@/lib/actions";
import { APP_DISPLAY_NAME, APP_TAGLINE } from "@/lib/brand";
import { Logo } from "@/components/logo";
import { GoogleSignIn } from "@/components/google-sign-in";
import { CreateJoinTour } from "@/components/create-join-tour";
import { SignOutButton } from "@/components/sign-out-button";
import { NicknameSetting } from "@/components/nickname-setting";

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
      <main className="flex min-h-[85dvh] flex-col justify-center gap-8">
        <header className="space-y-2 text-center">
          <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-[28px] border border-teal-100 bg-white shadow-[0_16px_40px_rgba(15,118,110,0.12)]">
            <Logo className="h-16 w-16" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{APP_DISPLAY_NAME}</h1>
          <p className="mx-auto max-w-xs text-base leading-relaxed text-slate-600">{APP_TAGLINE}</p>
        </header>
        <GoogleSignIn />
      </main>
    );
  }

  const toursRes = await getMyTours();
  const tours = toursRes.ok ? (toursRes.data ?? []) : [];

  return (
    <main className="space-y-7">
      <div className="space-y-2">
        <header className="flex items-center justify-between gap-3 pb-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-teal-100">
              <Logo className="h-10 w-10" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{APP_DISPLAY_NAME}</h1>
              <p className="truncate text-sm text-slate-500">Hi, {user.name}</p>
            </div>
          </div>
          <SignOutButton />
        </header>
        <NicknameSetting nickname={user.nickname} />
      </div>

      <section className="space-y-4 rounded-[28px] bg-teal-900 px-5 py-6 text-white shadow-[0_16px_32px_rgba(15,118,110,0.16)]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Where to next?</h2>
          <p className="mt-1 text-sm leading-relaxed text-teal-100">Bring your group together and keep every shared expense clear.</p>
        </div>
        <CreateJoinTour />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">My tours</h2>
          {tours.length > 0 && <span className="text-sm text-slate-500">{tours.length} total</span>}
        </div>
        {tours.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-teal-200 bg-white/70 p-5 text-sm text-slate-500">
            You haven&apos;t joined any tours yet. Create one or join with a PIN.
          </p>
        ) : (
          <ul className="grid gap-3">
            {tours.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${t.id}`}
                  className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm transition-colors hover:border-teal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-lg" aria-hidden="true">✦</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{t.name}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {t.role}
                  </span>
                  <span className="shrink-0 text-lg text-teal-700" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
