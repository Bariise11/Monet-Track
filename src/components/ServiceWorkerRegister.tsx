"use client";

import { useEffect } from "react";
import { registerWorker } from "@/lib/notify";

/** Starts the service worker (offline page, installable app, reminders) as soon as the app loads. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    registerWorker();
  }, []);
  return null;
}
