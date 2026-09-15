# Sannidhi architecture

## Shape

```
Organisation
  └── Centre
        └── Sabha location  (pin + radius)
              └── Sabha session  (date + punch window)
                    └── Attendance record
                          └── Attendance events (append-only)
```

The first release uses a single default organisation and centre. The tables already have those keys so more centres can be added later.

## Authoritative clock

The browser may send a local timestamp. It is stored as supporting data only.

`punch_in_time` / `punch_out_time` are set with `now()` on the server. Role, user id, geofence, and session window are also decided on the server. Frontend values are never trusted for those decisions.

## Geofence

`src/lib/geo.ts` implements Haversine (mean Earth radius 6,371 km).

Verdicts:

| Verdict | Meaning | Default punch-in |
| --- | --- | --- |
| inside | distance ≤ radius | allow |
| borderline | distance ≤ radius + GPS accuracy | allow (indoors are noisy) |
| outside | clearly beyond radius + accuracy | deny, unless the session allows exceptions |
| inaccurate | accuracy worse than 500 m and 2× radius | deny, unless exceptions |
| missing | no coordinates | deny, unless exceptions |

Punch-out may be allowed outside the fence (`allow_out_of_geofence_punch_out`) and is flagged.

Location is read with `navigator.geolocation.getCurrentPosition` only. There is no `watchPosition` and no background tracking.

## Roles

| Role | Punch | Live desk | Locations | People | Audit |
| --- | --- | --- | --- | --- | --- |
| satsangi | own | — | — | — | — |
| coordinator | own | yes | no | view | no |
| admin | own | yes | yes | yes | yes |
| super_admin | own | yes | yes | yes, including roles | yes |

The first profile inserted becomes `super_admin`.

## Attendance integrity

- Unique `(user_id, session_id)` while status is not `cancelled`
- Duplicate punch-in / punch-out rejected
- In-process rate limit on punch endpoints
- Manual corrections insert `MANUAL_*` and `CORRECTION` events; they never delete history
- Every admin mutation writes `audit_logs` with actor, old/new value, and reason

## Auth

Better Auth at `/api/auth/*`. Methods: Google, X, email/password. Server functions use `authMiddleware` and `context.userId`. Client-supplied user ids are ignored.

## PWA / mobile later

The UI is a PWA. Native shells (Capacitor) can wrap the same origin later because the API is server functions, not a coupled native module.

## Data retention

`system_settings.location_retention_days` defaults to 365. A later job can null location columns on events older than that without dropping the attendance fact.
