"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestReset,
  resetPassword,
  type ResetState,
} from "@/lib/reset-actions";

export function ForgotForm({ devHint }: { devHint: boolean }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestReset, {});
  return (
    <form action={action} className="card auth-card">
      <h1>Forgot your password?</h1>
      <p className="muted" style={{ margin: 0 }}>
        Enter your account email and we&apos;ll send you a 6-digit code.
      </p>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" maxLength={120} />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary" disabled={pending}>
        {pending ? "Sending…" : "Send code"}
      </button>
      {devHint && (
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          Email isn&apos;t set up on this server yet, so the code is printed in the server terminal.
          See <code>.env.example</code> to enable real emails.
        </p>
      )}
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        <Link href="/login" style={{ textDecoration: "underline" }}>
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});
  return (
    <form action={action} className="card auth-card">
      <h1>Enter your code</h1>
      <p className="muted" style={{ margin: 0 }}>
        If an account exists for <strong>{email || "that email"}</strong>, a 6-digit code was sent. It
        expires in 15 minutes.
      </p>
      <label>
        Email
        <input name="email" type="email" required defaultValue={email} autoComplete="email" />
      </label>
      <label>
        6-digit code
        <input
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="123456"
          style={{ letterSpacing: "0.3em", fontSize: "1.2rem" }}
        />
      </label>
      <label>
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <label>
        Confirm new password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        Didn&apos;t get a code?{" "}
        <Link href="/forgot-password" style={{ textDecoration: "underline" }}>
          Send again
        </Link>
      </p>
    </form>
  );
}
