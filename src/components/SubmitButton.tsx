"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that shows progress and ignores double clicks while its form is working. */
export default function SubmitButton({
  children,
  pendingText = "Please wait…",
  className = "btn primary",
  style,
  title,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} style={style} title={title} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
