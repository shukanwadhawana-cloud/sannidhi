import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, House, LayoutGrid, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { Profile } from "@/lib/types";
import { isStaff } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";

export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile?: Profile | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const staff = profile ? isStaff(profile.role) : false;

  const tabs = staff
    ? ([
        { to: "/", label: "Today", icon: House },
        { to: "/history", label: "History", icon: CalendarDays },
        { to: "/team", label: "Team", icon: Users },
        { to: "/more", label: "More", icon: LayoutGrid },
      ] as const)
    : ([
        { to: "/", label: "Today", icon: House },
        { to: "/history", label: "History", icon: CalendarDays },
        { to: "/more", label: "More", icon: LayoutGrid },
      ] as const);

  const moreActive =
    pathname.startsWith("/more") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/regularize") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/admin");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-5xl">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-md md:px-6">
        <Link to="/" aria-label="Sannidhi home">
          <Wordmark compact />
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" aria-label="Primary">
          {tabs.map((tab) => {
            const active =
              tab.to === "/"
                ? pathname === "/"
                : tab.to === "/more"
                  ? moreActive
                  : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {staff ? (
            <Link
              to="/admin"
              className={cn(
                "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium md:inline-flex",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Shield className="size-3.5" />
              Desk
            </Link>
          ) : null}
          {isPending ? (
            <div className="size-8 animate-pulse rounded-full bg-secondary" />
          ) : (
            <div className="min-w-0 [&_span.text-sm.font-medium]:hidden md:[&_span.text-sm.font-medium]:inline md:[&_span.text-sm.font-medium]:max-w-[10rem] md:[&_span.text-sm.font-medium]:truncate">
              <UserButton />
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-12">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        <ul className={cn("mx-auto grid max-w-lg", staff ? "grid-cols-4" : "grid-cols-3")}>
          {tabs.map((tab) => {
            const active =
              tab.to === "/"
                ? pathname === "/"
                : tab.to === "/more"
                  ? moreActive
                  : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function AdminSubnav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const links = [
    { to: "/admin", label: "Overview" },
    { to: "/admin/approvals", label: "Approvals" },
    { to: "/admin/sessions", label: "Sessions" },
    { to: "/admin/locations", label: "Locations" },
    { to: "/admin/people", label: "People" },
    { to: "/admin/reports", label: "Reports" },
    { to: "/admin/policy", label: "Policy" },
    { to: "/admin/audit", label: "Audit" },
  ] as const;
  return (
    <div className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {links.map((link) => {
        const active = link.to === "/admin" ? pathname === "/admin" : pathname.startsWith(link.to);
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              "shrink-0 rounded-full px-3 py-2 text-sm font-medium",
              active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
