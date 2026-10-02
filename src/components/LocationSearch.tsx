import { useEffect, useId, useRef, useState } from "react";
import { searchAddresses, type AddressSuggestion } from "../core/geocoding";
import type { Network } from "../core/network";
import { searchStations } from "../core/station-search";
import type { Location, Station } from "../types";
import LineBadge from "./LineBadge";

const STATION_RESULTS = 5;
const ADDRESS_DEBOUNCE_MS = 300;
const ADDRESS_MIN_LENGTH = 3;

const isAddressQuery = (query: string): boolean => query.trim().length >= ADDRESS_MIN_LENGTH;

interface LocationSearchProps {
  network: Network;
  onSelect: (location: Location) => void;
  disabled?: boolean;
}

const LocationSearch = ({ network, onSelect, disabled = false }: LocationSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<AddressSuggestion[]>([]);
  const [addressStatus, setAddressStatus] = useState<"idle" | "loading" | "error">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const stations = searchStations(network.stations, query, STATION_RESULTS);

  useEffect(() => {
    if (!isAddressQuery(query)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAddressStatus("loading");
      searchAddresses(query, controller.signal)
        .then((results) => {
          setAddresses(results);
          setAddressStatus("idle");
        })
        .catch(() => {
          if (!controller.signal.aborted) setAddressStatus("error");
        });
    }, ADDRESS_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const select = (location: Location) => {
    onSelect(location);
    setQuery("");
    setAddresses([]);
    setOpen(false);
  };

  const selectStation = (station: Station) => select({ kind: "station", stationId: station.id });
  const selectAddress = (address: AddressSuggestion) =>
    select({ kind: "address", label: address.label, lat: address.lat, lon: address.lon });

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "Enter") {
      event.preventDefault();
      if (stations[0]) selectStation(stations[0]);
      else if (addresses[0]) selectAddress(addresses[0]);
    }
  };

  const hasResults = stations.length > 0 || addresses.length > 0;
  const showList = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (!isAddressQuery(value)) {
            setAddresses([]);
            setAddressStatus("idle");
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Station ou adresse"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 disabled:bg-stone-100"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-72 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-lg"
        >
          {stations.length > 0 && (
            <li className="px-3 pt-1 pb-0.5 text-xs uppercase text-stone-500">Stations</li>
          )}
          {stations.map((station) => (
            <li key={station.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => selectStation(station)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-stone-100"
              >
                <span className="flex-1 truncate">{station.name}</span>
                <span className="flex gap-0.5">
                  {station.lines.map((line) => (
                    <LineBadge key={line} line={line} style={network.data.lines[line]} />
                  ))}
                </span>
              </button>
            </li>
          ))}
          {(addresses.length > 0 || addressStatus !== "idle") && (
            <li className="px-3 pt-2 pb-0.5 text-xs uppercase text-stone-500">Adresses</li>
          )}
          {addresses.map((address) => (
            <li key={`${address.lat},${address.lon}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => selectAddress(address)}
                className="w-full truncate px-3 py-1.5 text-left hover:bg-stone-100"
              >
                {address.label}
              </button>
            </li>
          ))}
          {addressStatus === "loading" && <li className="px-3 py-1.5 text-stone-500">Recherche…</li>}
          {addressStatus === "error" && (
            <li className="px-3 py-1.5 text-red-600">Recherche d’adresse indisponible</li>
          )}
          {!hasResults && addressStatus === "idle" && (
            <li className="px-3 py-1.5 text-stone-500">
              {isAddressQuery(query) ? "Aucun résultat" : "Tape au moins 3 caractères"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
