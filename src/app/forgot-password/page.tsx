import AlreadyLoggedIn from "@/components/AlreadyLoggedIn";
import { ForgotForm } from "@/components/ResetForms";
import { getUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await getUser();
  if (user) return <AlreadyLoggedIn user={user} />;
  return <ForgotForm devHint={!mailConfigured() && process.env.NODE_ENV !== "production"} />;
}
