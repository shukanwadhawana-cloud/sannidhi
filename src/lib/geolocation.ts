export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeoErrorCode =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout"
  | "offline";

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function humanGeoError(error: unknown): { code: GeoErrorCode; message: string } {
  if (error instanceof GeoError) return { code: error.code, message: error.message };
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
      return {
        code: "denied",
        message:
          "Location permission is required to verify that you’re at the Sabha. Please enable location access and try again.",
      };
    }
    if (error.code === error.TIMEOUT) {
      return {
        code: "timeout",
        message: "We couldn’t read your location in time. Please wait a few seconds and try again.",
      };
    }
    return {
      code: "unavailable",
      message: "Your device could not determine a location. Move near a window and try again.",
    };
  }
  return {
    code: "unavailable",
    message: "We couldn’t read your location. Please try again.",
  };
}

export function readLocation(): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new GeoError(
        "unsupported",
        "This browser does not support location. Open Sannidhi on your phone to punch in.",
      ),
    );
  }
  if (typeof navigator.onLine === "boolean" && !navigator.onLine) {
    return Promise.reject(
      new GeoError("offline", "An internet connection is required to record attendance."),
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        const mapped = humanGeoError(err);
        reject(new GeoError(mapped.code, mapped.message));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}
