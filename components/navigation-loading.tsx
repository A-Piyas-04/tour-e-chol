import { Logo } from "@/components/logo";

export function NavigationLoading() {
  return (
    <main className="navigation-loading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="navigation-loading__content">
        <div className="navigation-loading__mascot">
          <Logo className="h-16 w-16" />
        </div>
        <p className="mt-5 text-lg font-semibold text-slate-800">Getting your tour ready</p>
        <p className="mt-1 text-sm text-slate-500">Just a moment…</p>
        <div className="navigation-loading__bar" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
