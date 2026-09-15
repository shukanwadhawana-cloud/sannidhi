/** Earth radius in meters (mean). */
export const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in meters using the Haversine formula.
 * Inputs in decimal degrees. Returns a non-negative finite number.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const a = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_M * c;
}

export type GeofenceVerdict =
  | "inside"
  | "borderline"
  | "outside"
  | "inaccurate"
  | "missing";

export type GeofenceResult = {
  verdict: GeofenceVerdict;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  radiusMeters: number;
  /** True when the user may punch without being strictly inside. */
  canProceed: boolean;
  /** True when the resulting punch should be flagged as a location exception. */
  isException: boolean;
};

export type EvaluateGeofenceInput = {
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  accuracy: number | null | undefined;
  sabhaLat: number;
  sabhaLng: number;
  radiusMeters: number;
  allowExceptions: boolean;
  /** Punch-out may be allowed outside the fence even when punch-in is not. */
  allowOutside?: boolean;
};

/**
 * Decide whether a coordinate is acceptably at the Sabha.
 *
 * GPS indoors is noisy. A reading is:
 * - inside: distance <= radius
 * - borderline: distance <= radius + accuracy (likely at the hall, GPS lag)
 * - inaccurate: reported accuracy is worse than 500m and worse than 2× radius
 * - missing: no coordinates
 * - outside: clearly beyond radius + accuracy
 */
export function evaluateGeofence(input: EvaluateGeofenceInput): GeofenceResult {
  const radius = Math.max(10, input.radiusMeters);
  const accuracy =
    typeof input.accuracy === "number" && Number.isFinite(input.accuracy)
      ? Math.max(0, input.accuracy)
      : null;

  if (
    typeof input.userLat !== "number" ||
    typeof input.userLng !== "number" ||
    !Number.isFinite(input.userLat) ||
    !Number.isFinite(input.userLng)
  ) {
    return {
      verdict: "missing",
      distanceMeters: null,
      accuracyMeters: accuracy,
      radiusMeters: radius,
      canProceed: input.allowExceptions,
      isException: true,
    };
  }

  const distance = haversineMeters(
    input.userLat,
    input.userLng,
    input.sabhaLat,
    input.sabhaLng,
  );

  if (accuracy !== null && accuracy > 500 && accuracy > radius * 2) {
    return {
      verdict: "inaccurate",
      distanceMeters: roundMeters(distance),
      accuracyMeters: accuracy,
      radiusMeters: radius,
      canProceed: input.allowExceptions,
      isException: true,
    };
  }

  if (distance <= radius) {
    return {
      verdict: "inside",
      distanceMeters: roundMeters(distance),
      accuracyMeters: accuracy,
      radiusMeters: radius,
      canProceed: true,
      isException: false,
    };
  }

  const slack = accuracy ?? 0;
  if (distance <= radius + slack) {
    return {
      verdict: "borderline",
      distanceMeters: roundMeters(distance),
      accuracyMeters: accuracy,
      radiusMeters: radius,
      canProceed: true,
      isException: false,
    };
  }

  const allowOutside = Boolean(input.allowOutside) || input.allowExceptions;
  return {
    verdict: "outside",
    distanceMeters: roundMeters(distance),
    accuracyMeters: accuracy,
    radiusMeters: radius,
    canProceed: allowOutside,
    isException: true,
  };
}

export function roundMeters(n: number): number {
  return Math.round(n * 10) / 10;
}

export function describeGeofence(result: GeofenceResult): string {
  switch (result.verdict) {
    case "inside":
      return "You appear to be at the Sabha.";
    case "borderline":
      return "Your location is near the Sabha. GPS is a little uncertain indoors.";
    case "outside": {
      const d = result.distanceMeters;
      return d !== null
        ? `You appear to be about ${Math.round(d)} meters away from the Sabha location.`
        : "You appear to be outside the Sabha area.";
    }
    case "inaccurate":
      return "Your location accuracy is currently low. Please wait a few seconds and try again.";
    case "missing":
      return "Location permission is required to verify that you’re at the Sabha. Please enable location access and try again.";
  }
}
