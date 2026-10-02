export function barsNearbyUrl(lat: number, lon: number): { label: string; url: string } {
  return {
    label: "Bars autour (Google Maps)",
    url: `https://www.google.com/maps/search/bar/@${lat},${lon},17z`,
  };
}
