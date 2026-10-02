const ADDRESS_API_URL = "https://api-adresse.data.gouv.fr/search/";
const PARIS_CENTER = { lat: 48.8566, lon: 2.3522 };

export interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

interface AddressApiResponse {
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: { label: string };
  }>;
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const params = new URLSearchParams({
    q: trimmed,
    limit: "5",
    lat: String(PARIS_CENTER.lat),
    lon: String(PARIS_CENTER.lon),
  });
  const response = await fetch(`${ADDRESS_API_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Address API responded with ${response.status}`);
  const payload = (await response.json()) as AddressApiResponse;
  return payload.features.map((feature) => ({
    label: feature.properties.label,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  }));
}
