import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { isAdmin } from "@/lib/roles";
import { getOrgPolicy, updateOrgPolicy } from "@/lib/server/desk";
import { getMyProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/admin/policy")({ component: PolicyPage });

const GRACE = [0, 5, 10, 15, 20, 30];

function PolicyPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const policy = useQuery({ queryKey: ["org-policy"], queryFn: () => getOrgPolicy() });
  const [grace, setGrace] = useState(10);

  useEffect(() => {
    if (policy.data) setGrace(policy.data.graceMinutes);
  }, [policy.data]);

  const save = useMutation({
    mutationFn: () => updateOrgPolicy({ data: { graceMinutes: grace } }),
    onSuccess: () => {
      toast.success("Policy saved.");
      void qc.invalidateQueries({ queryKey: ["org-policy"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (profile.data && !isAdmin(profile.data.role)) {
    return <Card className="p-6">Only administrators can edit org policy.</Card>;
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">Organisation</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Arrival grace is how late someone may punch in after scheduled start without being marked late.
      </p>
      <Card className="mt-6 max-w-md p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Arrival grace" htmlFor="grace">
            <Select
              id="grace"
              value={String(grace)}
              onChange={(e) => setGrace(Number(e.target.value))}
            >
              {GRACE.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "No grace — mark late after start" : `${n} minutes`}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save policy"}
          </Button>
        </form>
      </Card>
      <Card className="mt-4 max-w-md p-5 text-sm leading-relaxed text-muted-foreground">
        Hall radius, punch windows, and location exceptions are still set per location and per
        session. This page is for org-wide people-policy, like PeopleStrong grace minutes.
      </Card>
    </div>
  );
}
