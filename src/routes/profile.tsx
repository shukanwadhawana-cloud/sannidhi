import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { roleLabel } from "@/lib/format";
import { getMyProfile, updateMyProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [memberId, setMemberId] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.fullName);
    setMobile(profile.data.mobile ?? "");
    setMemberId(profile.data.memberId ?? "");
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => updateMyProfile({ data: { fullName, mobile, memberId } }),
    onSuccess: () => {
      toast.success("Profile saved.");
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell profile={profile.data}>
      <h1 className="font-display text-3xl font-semibold">Your details</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kept simple. Only what’s needed for attendance.
      </p>
      <Card className="mt-6 p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Full name" htmlFor="fullName">
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Mobile" htmlFor="mobile" hint="Optional. Never used for paid SMS.">
            <Input id="mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
          <Field label="Member ID" htmlFor="memberId" hint="Optional satsangi / member number.">
            <Input id="memberId" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
          </Field>
          <div className="text-sm text-muted-foreground">
            Role: {profile.data ? roleLabel(profile.data.role) : "—"}
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/privacy" className="underline underline-offset-4">
          Privacy notice
        </Link>
      </p>
    </AppShell>
  );
}
