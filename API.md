# Sannidhi server functions

All of these run behind `authMiddleware`. A signed-out caller receives `Unauthorized` (401). Staff-only functions also check `profiles.role` on the server.

## Satsangi

| Function | Method | Purpose |
| --- | --- | --- |
| `getHomeData` | GET | Current session, my attendance, recent history |
| `punchIn` | POST | Verify geofence + window; insert record + `PUNCH_IN` event |
| `punchOut` | POST | Same for exit; set duration from server timestamps |
| `listMyHistory` | POST | Own records only (`where user_id = context.userId`) |
| `getMyProfile` / `updateMyProfile` | GET/POST | Name, mobile, member id |

### Punch payload

```ts
{
  sessionId: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  clientTime: string          // stored, never authoritative
  userAgent?: string
  forceException?: boolean    // honoured only if the session allows it
}
```

### Punch result

```ts
{ ok: true, record, geofenceVerdict, exception }
// or
{ ok: false, code, message, distanceMeters?, canRetryWithException? }
```

Codes: `NO_SESSION`, `WINDOW_CLOSED`, `ALREADY_IN`, `ALREADY_OUT`, `NOT_CHECKED_IN`, `OUTSIDE_GEOFENCE`, `GPS_INACCURATE`, `LOCATION_MISSING`, `RATE_LIMIT`.

## Coordinator / admin

| Function | Who | Purpose |
| --- | --- | --- |
| `getAdminOverview` | staff | Today’s counts |
| `listLiveAttendance` | staff | Rows for one session |
| `listSessions` / `getSession` / `saveSession` | staff | Session CRUD |
| `listLocations` | staff | Halls |
| `saveLocation` | admin | Create/update hall + radius |
| `searchPlaces` | staff | Nominatim proxy (no paid geocoder) |
| `listPeople` | staff | Directory |
| `updatePerson` | admin | Role / active flag |
| `correctAttendance` | staff | Manual in/out + required reason + audit |
| `getReport` | staff | Metrics + CSV string |
| `listAudit` | admin | Recent administrative changes |

There is no public “set my status” or “set punch time” endpoint. Corrections always go through `correctAttendance`.
