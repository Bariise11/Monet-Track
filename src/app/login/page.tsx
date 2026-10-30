import AlreadyLoggedIn from "@/components/AlreadyLoggedIn";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; loggedout?: string }>;
}) {
  const user = await getUser();
  if (user) return <AlreadyLoggedIn user={user} />;
  const { reset, loggedout } = await searchParams;
  return (
    <AuthForm
      mode="login"
      notice={
        reset === "1"
          ? "Password changed. Log in with your new password."
          : loggedout === "1"
            ? "You are logged out."
            : undefined
      }
    />
  );
}
