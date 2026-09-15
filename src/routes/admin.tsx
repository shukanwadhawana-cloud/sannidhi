import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminSubnav, AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { Card } from "@/components/ui/card";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isStaff } from "@/lib/roles";
import { getMyProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, isPending } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });

  if (isPending || profile.isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;
  if (!profile.data || !isStaff(profile.data.role)) {
    return (
      <AppShell profile={profile.data}>
        <Card className="p-6">You do not have access to coordinator tools.</Card>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile.data}>
      <AdminSubnav />
      <Outlet />
    </AppShell>
  );
}
