"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth-actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/loans", label: "Loans" },
  { href: "/report", label: "Report" },
  { href: "/categories", label: "Categories" },
];

export default function Nav({ user }: { user: { name: string; email: string } | null }) {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="nav-inner">
        <span className="brand">💸 Money Track</span>
        {user && (
          <>
            <nav>
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="nav-user">
              <span className="who" title="You are logged in as this account">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <form action={logout}>
                <button className="btn ghost" style={{ padding: "5px 10px" }}>
                  Log out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
