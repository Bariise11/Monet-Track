import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { logout } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

/**
 * Shown instead of the login / signup pages when someone is already logged in,
 * so it is obvious which account is active and how to switch to another one.
 */
export default function AlreadyLoggedIn({ user }: { user: SessionUser }) {
  return (
    <div className="card auth-card">
      <h1>You are already logged in</h1>
      <p style={{ margin: 0 }}>
        Logged in as <strong>{user.name}</strong>
        <br />
        <span className="muted">{user.email}</span>
      </p>
      <Link href="/" className="btn primary">
        Continue as {user.name}
      </Link>
      <form action={logout} style={{ display: "contents" }}>
        <SubmitButton className="btn" pendingText="Logging out…">
          Not you? Log out and use another account
        </SubmitButton>
      </form>
    </div>
  );
}
