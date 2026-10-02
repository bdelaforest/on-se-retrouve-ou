export function isAppleDevice(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Macintosh/.test(userAgent);
}

export function barsNearbyUrl(lat: number, lon: number, userAgent: string): { label: string; url: string } {
  if (isAppleDevice(userAgent)) {
    return { label: "Bars autour (Plans)", url: `https://maps.apple.com/?q=bar&sll=${lat},${lon}&z=16` };
  }
  return {
    label: "Bars autour (Google Maps)",
    url: `https://www.google.com/maps/search/bar/@${lat},${lon},17z`,
  };
}
