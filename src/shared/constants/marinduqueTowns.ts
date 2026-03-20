export const MARINDUQUE_TOWNS = [
  'Boac',
  'Buenavista',
  'Gasan',
  'Mogpog',
  'Santa Cruz',
  'Torrijos',
] as const;

export type MarinduqueTown = (typeof MARINDUQUE_TOWNS)[number];

export const MARINDUQUE_TOWN_VIEW: Record<
  MarinduqueTown,
  { center: google.maps.LatLngLiteral; zoom: number }
> = {
  Boac: {
    center: { lat: 13.4466, lng: 121.8390 },
    zoom: 13,
  },
  Buenavista: {
    center: { lat: 13.2555, lng: 121.9398 },
    zoom: 13,
  },
  Gasan: {
    center: { lat: 13.3247, lng: 121.8467 },
    zoom: 13,
  },
  Mogpog: {
    center: { lat: 13.4737, lng: 121.8610 },
    zoom: 13,
  },
  'Santa Cruz': {
    center: { lat: 13.4754, lng: 121.9548 },
    zoom: 12,
  },
  Torrijos: {
    center: { lat: 13.3158, lng: 122.0820 },
    zoom: 13,
  },
};