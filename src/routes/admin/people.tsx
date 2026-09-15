import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge, Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import type { Role } from "@/lib/constants";
import { roleLabel } from "@/lib/format";
import { canChangeRole, isAdmin } from "@/lib/roles";
import { getMyProfile } from "@/lib/server/profile";
import { listPeople, updatePerson } from "@/lib/server/people";

export const Route = createFileRoute("/admin/people")({ component: PeoplePage });

function PeoplePage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const people = useQuery({ queryKey: ["people"], queryFn: () => listPeople() });
  const actor = profile.data;
  const mutate = useMutation({
    mutationFn: (d: { userId: string; role?: Role; status?: "active" | "inactive" }) =>
      updatePerson({ data: d }),
    onSuccess: () => {
      toast.success("Updated.");
      void qc.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">People</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        First person to sign in becomes the super administrator. Everyone else starts as a satsangi.
      </p>
      <ul className="mt-5 grid gap-2">
        {people.data?.map((p) => (
          <li key={p.userId}>
            <Card className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{p.fullName}</p>
                  <p className="text-sm text-muted-foreground">{p.email || "No email"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.status === "active" ? "ok" : "neutral"}>{p.status}</Badge>
                  {actor && isAdmin(actor.role) && canChangeRole(actor.role, p.role) ? (
                    <>
                      <Select
                        className="w-auto"
                        value={p.role}
                        onChange={(e) => mutate.mutate({ userId: p.userId, role: e.target.value as Role })}
                        aria-label={`Role for ${p.fullName}`}
                      >
                        <option value="satsangi">Satsangi</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="admin">Administrator</option>
                        {actor.role === "super_admin" ? (
                          <option value="super_admin">Super administrator</option>
                        ) : null}
                      </Select>
                      <Select
                        className="w-auto"
                        value={p.status}
                        onChange={(e) =>
                          mutate.mutate({
                            userId: p.userId,
                            status: e.target.value as "active" | "inactive",
                          })
                        }
                        aria-label={`Status for ${p.fullName}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{roleLabel(p.role)}</span>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
