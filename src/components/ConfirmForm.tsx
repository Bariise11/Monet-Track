"use client";

import type { ReactNode } from "react";

/** A form whose submit asks for confirmation first. */
export default function ConfirmForm({
  action,
  message,
  children,
}: {
  action: () => Promise<void>;
  message: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
