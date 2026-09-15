import { useEffect, useRef } from "react";

type Props = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
};

export function LocationMap({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  interactive = true,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, {
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
      }).setView([latitude, longitude], 17);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      markerRef.current = L.circleMarker([latitude, longitude], {
        radius: 8,
        color: "#2f5d4a",
        weight: 2,
        fillColor: "#2f5d4a",
        fillOpacity: 1,
      }).addTo(map);

      circleRef.current = L.circle([latitude, longitude], {
        radius: radiusMeters,
        color: "#2f5d4a",
        weight: 1,
        fillColor: "#2f5d4a",
        fillOpacity: 0.12,
      }).addTo(map);

      if (interactive) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          onChangeRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Map instance is created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
    circleRef.current?.setLatLng([latitude, longitude]);
    circleRef.current?.setRadius(radiusMeters);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude, radiusMeters]);

  return (
    <div
      ref={el}
      className="sannidhi-map h-64 w-full overflow-hidden rounded-lg border border-border"
      role="img"
      aria-label="Map of the Sabha location"
    />
  );
}
