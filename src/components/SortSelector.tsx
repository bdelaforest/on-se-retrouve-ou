import { SORT_MODES, type SortMode } from "../types";

const LABELS: Record<SortMode, string> = {
  max: "Temps max",
  total: "Temps total",
  spread: "Écart",
};

interface SortSelectorProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
}

const SortSelector = ({ value, onChange }: SortSelectorProps) => (
  <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm" role="radiogroup">
    {SORT_MODES.map((mode) => (
      <button
        key={mode}
        type="button"
        role="radio"
        aria-checked={mode === value}
        onClick={() => onChange(mode)}
        className={`rounded-md px-3 py-1 transition ${
          mode === value ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
        }`}
      >
        {LABELS[mode]}
      </button>
    ))}
  </div>
);

export default SortSelector;
