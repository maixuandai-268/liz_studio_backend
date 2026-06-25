// ─── Geo Configuration ───
export const COMPANY_LAT = parseFloat(process.env.COMPANY_LAT || '21.024418');
export const COMPANY_LNG = parseFloat(process.env.COMPANY_LNG || '105.810977');
export const COMPANY_RADIUS_METERS = 150;

// ─── Work Hours (GMT+7, local time) ───
export const START_HOUR = 10;
export const START_MINUTE = 0;
export const END_HOUR = 20;
export const END_MINUTE = 0;
export const WORKDAY_MINUTES = (END_HOUR - START_HOUR) * 60 - 120; // 600 min (10h)

// ─── Late Policy ───
export const LATE_GRACE_MINUTES = 15; // into work = 15 minutes

// ─── Work Days (0=Sun, 1=Mon ... 6=Sat) ───
// Monday through Saturday
export const WORKDAYS = [1, 2, 3, 4, 5, 6];

// ─── Geo Utils ───

/**
 * Haversine distance between two lat/lng points in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isWithinGeoRange(lat: number, lng: number): boolean {
  const distance = haversineDistance(lat, lng, COMPANY_LAT, COMPANY_LNG);
  return distance <= COMPANY_RADIUS_METERS;
}
