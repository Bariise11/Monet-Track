"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { login, signup, type AuthState } from "@/lib/auth-actions";

export default function AuthForm({
  mode,
  notice,
}: {
  mode: "login" | "signup";
  notice?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    {},
  );
  const isSignup = mode === "signup";
  const formRef = useRef<HTMLFormElement>(null);
  const typed = useRef(false); // true once the person has pressed a key in the form

  function wipe() {
    formRef.current?.querySelectorAll<HTMLInputElement>("input").forEach((el) => {
      if (el.type !== "hidden") el.value = "";
    });
  }

  function clearAll() {
    wipe();
    typed.current = false;
    formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }

  /*
   * The login form always starts empty, however the person got here: after logging out,
   * after being redirected because they weren't logged in, or by pressing Back
   * (browsers restore old field values from their cache). Anything the person has
   * actually typed is never touched.
   */
  useEffect(() => {
    if (isSignup) return;
    const clearUntouched = () => {
      if (!typed.current) wipe();
    };
    // browsers fill saved logins a moment after load, so clear a few times
    const timers = [0, 100, 500, 1200, 2500].map((ms) => setTimeout(clearUntouched, ms));
    // page restored from the back/forward cache
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        typed.current = false;
        clearUntouched();
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pageshow", onShow);
    };
  }, [isSignup]);

  return (
    <form
      ref={formRef}
      action={action}
      className="card auth-card"
      autoComplete="off"
      onKeyDown={() => {
        typed.current = true;
      }}
      // fired by the CSS animation that Chrome triggers when it auto-fills a saved login
      onAnimationStart={(e) => {
        if (!isSignup && e.animationName === "mt-autofill" && !typed.current) {
          (e.target as HTMLInputElement).value = "";
        }
      }}
    >
      <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {isSignup
          ? "Your money records are private to your account."
          : "Log in to see your money."}
      </p>

      {notice && <p className="notice">{notice}</p>}

      {isSignup && (
        <label>
          Name
          <input name="name" required autoComplete="off" maxLength={60} defaultValue={state.name ?? ""} />
        </label>
      )}
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="off"
          maxLength={120}
          defaultValue={state.email ?? ""}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          // "new-password" stops browsers from filling in a saved password
          autoComplete="new-password"
        />
      </label>
      {isSignup && (
        <label>
          Confirm password
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
      )}

      {!isSignup && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: -4 }}>
          <button type="button" className="link-btn" style={{ fontSize: "0.85rem" }} onClick={clearAll}>
            Use a different account (clear)
          </button>
          <Link
            href="/forgot-password"
            className="muted"
            style={{ fontSize: "0.85rem", textDecoration: "underline" }}
          >
            Forgot password?
          </Link>
        </div>
      )}
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary" disabled={pending}>
        {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
      </button>
      <p className="muted" style={{ margin: 0, textAlign: "center" }}>
        {isSignup ? (
          <>
            Already have an account? <Link href="/login" style={{ textDecoration: "underline" }}>Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup" style={{ textDecoration: "underline" }}>Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
