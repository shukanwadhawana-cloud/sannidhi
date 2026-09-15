import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
import { BrandedSplash } from "@/components/branded-splash";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <BrandedSplash message="Checking your session…" />;
  if (user) return <Navigate to="/" />;
  return <AuthScreen />;
}
