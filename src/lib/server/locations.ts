import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { DEFAULT_CENTRE_ID, RADIUS_OPTIONS } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { assertAdmin, assertStaff } from "@/lib/roles";
import type { PlaceHit, SabhaLocation } from "@/lib/types";
import { mapLocation, writeAudit } from "./map";
import { ensureProfile } from "./profile";

type LocationInput = {
  id?: string;
  name: string;
  address?: string;
  description?: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  isActive: boolean;
};

function parseLocation(d: LocationInput): LocationInput {
  const name = (d.name ?? "").trim();
  if (name.length < 2) throw new Error("Please name this Sabha location.");
  if (!Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) {
    throw new Error("Place the marker on the map to set the location.");
  }
  if (Math.abs(d.latitude) > 90 || Math.abs(d.longitude) > 180) {
    throw new Error("Those coordinates do not look valid.");
  }
  const radius = Number(d.allowedRadiusMeters);
  if (!RADIUS_OPTIONS.includes(radius as (typeof RADIUS_OPTIONS)[number]) && (radius < 10 || radius > 5000)) {
    throw new Error("Choose an allowed radius between 10 and 5,000 meters.");
  }
  return {
    id: d.id,
    name: name.slice(0, 80),
    address: (d.address ?? "").trim().slice(0, 200) || undefined,
    description: (d.description ?? "").trim().slice(0, 400) || undefined,
    latitude: d.latitude,
    longitude: d.longitude,
    allowedRadiusMeters: Math.round(radius),
    isActive: Boolean(d.isActive),
  };
}

export const listLocations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SabhaLocation[]> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from sabha_locations
      where organization_id = ${profile.organizationId}
      order by name asc
    `;
    return rows.map(mapLocation);
  });

export const saveLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseLocation)
  .handler(async ({ context, data }) => {
    const profile = await ensureProfile(context.userId);
    assertAdmin(profile);
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();

    if (data.id) {
      const prev = await sql<Record<string, unknown>>`
        select * from sabha_locations where id = ${id} and organization_id = ${profile.organizationId} limit 1
      `;
      await sql`
        update sabha_locations
        set name = ${data.name},
            address = ${data.address ?? null},
            description = ${data.description ?? null},
            latitude = ${data.latitude},
            longitude = ${data.longitude},
            allowed_radius_meters = ${data.allowedRadiusMeters},
            is_active = ${data.isActive},
            updated_at = now()
        where id = ${id} and organization_id = ${profile.organizationId}
      `;
      await writeAudit(sql, {
        organizationId: profile.organizationId,
        actorUserId: profile.userId,
        action: "update_location",
        entityType: "sabha_location",
        entityId: id,
        oldValue: prev[0] ?? null,
        newValue: data,
      });
    } else {
      await sql`
        insert into sabha_locations (
          id, organization_id, centre_id, name, address, description,
          latitude, longitude, allowed_radius_meters, is_active, created_by
        ) values (
          ${id},
          ${profile.organizationId},
          ${DEFAULT_CENTRE_ID},
          ${data.name},
          ${data.address ?? null},
          ${data.description ?? null},
          ${data.latitude},
          ${data.longitude},
          ${data.allowedRadiusMeters},
          ${data.isActive},
          ${profile.userId}
        )
      `;
      await writeAudit(sql, {
        organizationId: profile.organizationId,
        actorUserId: profile.userId,
        action: "create_location",
        entityType: "sabha_location",
        entityId: id,
        newValue: data,
      });
    }
    const rows = await sql<Record<string, unknown>>`
      select * from sabha_locations where id = ${id} limit 1
    `;
    return mapLocation(rows[0]!);
  });

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((q: string) => {
    const query = (q ?? "").trim();
    if (query.length < 3) throw new Error("Type at least three characters to search.");
    return query.slice(0, 120);
  })
  .handler(async ({ context, data }): Promise<PlaceHit[]> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", data);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SannidhiAttendance/1.0 (sabha attendance; contact@sannidhi.local)",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error("The map search is unavailable right now. Place the marker by hand.");
    const json = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
    return json
      .map((hit) => ({
        label: String(hit.display_name ?? ""),
        latitude: Number(hit.lat),
        longitude: Number(hit.lon),
      }))
      .filter((h) => h.label && Number.isFinite(h.latitude) && Number.isFinite(h.longitude));
  });
