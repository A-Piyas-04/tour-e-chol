import { signOut } from "@/lib/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOut} className="shrink-0">
      <button type="submit" className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline">
        Sign out
      </button>
    </form>
  );
}
