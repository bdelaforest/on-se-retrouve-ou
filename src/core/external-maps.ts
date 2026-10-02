export interface ExternalMapLink {
  label: string;
  url: string;
}

export function barsNearbyLinks(lat: number, lon: number): ExternalMapLink[] {
  return [
    { label: "Bars sur Google Maps", url: `https://www.google.com/maps/search/bar/@${lat},${lon},17z` },
    { label: "Bars sur Apple Plans", url: `https://maps.apple.com/?q=bar&sll=${lat},${lon}&z=16` },
  ];
}
