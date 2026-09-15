# Sannidhi

A free Progressive Web App for Sabha / Satsang attendance.

Open the app, see today’s Sabha, punch in. That’s the whole satsangi experience.

Sannidhi is **not** an HR product. It is a standalone attendance book for gatherings: one current session, a large punch button, and a backend that verifies location instead of trusting a tap.

## What it does

**Satsangis**

- Sign in with email, Google, or X
- See the active Sabha, hall, and time
- Punch in / punch out with browser geolocation
- Review their own history

**Coordinators and administrators**

- Create halls with a map pin and an allowed radius (50–1000 m)
- Create sessions with a punch-in window
- Watch live attendance
- Correct forgotten punches with a required reason
- Export CSV
- Read an audit log of administrative changes

## How punch-in works

1. The satsangi taps **Punch in**.
2. The browser asks for location *once* (no background tracking).
3. The server — not the phone clock — stamps the time.
4. Distance to the hall is calculated with the Haversine formula.
5. Punch-in is allowed inside the radius, or just outside it when GPS accuracy overlaps the fence.
6. If GPS fails or the person is clearly away, the session can allow a **location exception** so genuine failures are not a dead end. Exceptions are flagged for coordinators.

Punch actions require a live connection. Offline punch-in is refused on purpose.

## Stack

- React 19, TanStack Start, Tailwind v4
- Better Auth (email/password, Google, X)
- Postgres (Neon in production, embedded PGLite in preview)
- OpenStreetMap + Leaflet (no paid map API)
- PWA shell from the host platform

## Local development

The preview environment starts the app for you. If you are running the repo yourself:

```bash
npm install
npm run dev
```

The app listens on port 8080. No `.env` file is required in this environment. When deployed, `DATABASE_URL` and auth credentials are injected by the platform.

### First administrator

The first signed-in account becomes **super administrator**. Later accounts start as satsangis and can be promoted under Admin → People.

A sample hall (**Main Sabha Hall**) and an open session for today are created automatically so punch-in can be tried immediately. Move the map pin to your real hall before trusting the records.

### Tests

```bash
npm test
npm run typecheck
```

Geofence math is unit-tested against known coordinates, including the 100 m boundary.

## PWA

Install from the browser (Add to Home Screen). The host injects the web manifest and icons. Attendance still requires the network — the home screen icon does not enable offline punching.

## Privacy in one paragraph

Location is collected only at punch-in and punch-out, stored with accuracy and distance, visible to the person and to coordinators of that organisation, and retained for 365 days by default. See `/privacy` in the app.

## Future (not in this version)

QR / NFC fallback, OTP, native Capacitor shells, Hindi/Marathi, and reminders can be added without rewriting the attendance core. Business rules live in server functions, not in the UI.
