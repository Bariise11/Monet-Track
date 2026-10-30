import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import ReminderManager from "@/components/ReminderManager";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getUser } from "@/lib/auth";
import { getReminder } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Track",
  description: "Track every cent: income, spending, loans and monthly balance.",
  manifest: "/manifest.json", // renders <link rel="manifest" href="/manifest.json">
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "MoneyTrack", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const reminder = user ? getReminder(user.id) : null;
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <Nav user={user && { name: user.name, email: user.email }} />
        <main className="container">
          {reminder && <ReminderManager enabled={reminder.enabled} time={reminder.time} />}
          {children}
        </main>
      </body>
    </html>
  );
}
