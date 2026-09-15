import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LocationMap } from "@/components/location-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { RADIUS_OPTIONS } from "@/lib/constants";
import { isAdmin } from "@/lib/roles";
import { getMyProfile } from "@/lib/server/profile";
import { listLocations, saveLocation, searchPlaces } from "@/lib/server/locations";
import type { SabhaLocation } from "@/lib/types";

export const Route = createFileRoute("/admin/locations")({ component: LocationsPage });

const empty = {
  name: "",
  address: "",
  description: "",
  latitude: 19.076,
  longitude: 72.8777,
  allowedRadiusMeters: 100,
  isActive: true,
};

function LocationsPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const list = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const [editing, setEditing] = useState<(typeof empty & { id?: string }) | null>(null);
  const [query, setQuery] = useState("");

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Nothing to save.");
      return saveLocation({ data: editing });
    },
    onSuccess: () => {
      toast.success("Location saved.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const search = useMutation({
    mutationFn: () => searchPlaces({ data: query }),
    onError: (e: Error) => toast.error(e.message),
  });

  const canEdit = profile.data ? isAdmin(profile.data.role) : false;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Halls, centres, and their geofences.</p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing({ ...empty })}>New location</Button>
        ) : null}
      </div>

      {editing ? (
        <Card className="mt-5 p-5">
          <h2 className="font-display text-xl font-semibold">
            {editing.id ? "Edit location" : "New location"}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="loc-name">
              <Input
                id="loc-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Address" htmlFor="loc-address">
              <Input
                id="loc-address"
                value={editing.address}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Search place" htmlFor="loc-search" hint="OpenStreetMap search. Click the map to fine-tune.">
              <div className="flex gap-2">
                <Input
                  id="loc-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sabha hall, city"
                />
                <Button type="button" variant="secondary" onClick={() => search.mutate()}>
                  Search
                </Button>
              </div>
            </Field>
            {search.data?.length ? (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
                {search.data.map((hit) => (
                  <li key={`${hit.latitude}-${hit.longitude}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
                      onClick={() =>
                        setEditing((cur) =>
                          cur ? { ...cur, latitude: hit.latitude, longitude: hit.longitude, address: hit.label } : cur,
                        )
                      }
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="mt-4">
            <LocationMap
              latitude={editing.latitude}
              longitude={editing.longitude}
              radiusMeters={editing.allowedRadiusMeters}
              onChange={(lat, lng) => setEditing((cur) => (cur ? { ...cur, latitude: lat, longitude: lng } : cur))}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Allowed radius" htmlFor="loc-radius">
              <Select
                id="loc-radius"
                value={String(editing.allowedRadiusMeters)}
                onChange={(e) =>
                  setEditing({ ...editing, allowedRadiusMeters: Number(e.target.value) })
                }
              >
                {RADIUS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} meters
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="loc-active">
              <Select
                id="loc-active"
                value={editing.isActive ? "1" : "0"}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.value === "1" })}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Attendance will be allowed within approximately {editing.allowedRadiusMeters} meters of
            this location.
          </p>
          <Field label="Description" htmlFor="loc-desc">
            <Textarea
              id="loc-desc"
              className="mt-3"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </Field>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save location"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <ul className="mt-5 grid gap-2">
        {list.data?.map((loc) => (
          <LocationRow key={loc.id} loc={loc} canEdit={canEdit} onEdit={() => setEditing({ ...loc, address: loc.address ?? "", description: loc.description ?? "" })} />
        ))}
      </ul>
    </div>
  );
}

function LocationRow({
  loc,
  canEdit,
  onEdit,
}: {
  loc: SabhaLocation;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{loc.name}</p>
          <p className="text-sm text-muted-foreground">{loc.address || "No address"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Radius {loc.allowedRadiusMeters} m · {loc.isActive ? "Active" : "Inactive"}
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
