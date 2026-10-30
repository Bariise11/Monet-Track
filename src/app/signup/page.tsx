import AlreadyLoggedIn from "@/components/AlreadyLoggedIn";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getUser();
  if (user) return <AlreadyLoggedIn user={user} />;
  return <AuthForm mode="signup" />;
}
