import AlreadyLoggedIn from "@/components/AlreadyLoggedIn";
import { ResetForm } from "@/components/ResetForms";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const user = await getUser();
  if (user) return <AlreadyLoggedIn user={user} />;
  const { email } = await searchParams;
  return <ResetForm email={(email ?? "").slice(0, 120)} />;
}
