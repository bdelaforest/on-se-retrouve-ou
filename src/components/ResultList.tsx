import type { LineStyle, RankedStation, SortMode } from "../types";
import ResultCard, { type ParticipantDisplay } from "./ResultCard";
import SortSelector from "./SortSelector";

interface ResultListProps {
  chosen: RankedStation | null;
  alternatives: RankedStation[];
  availableCount: number;
  lines: Record<string, LineStyle>;
  participants: Map<string, ParticipantDisplay>;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onChoose: (stationId: string | null) => void;
}

const ResultList = ({
  chosen,
  alternatives,
  availableCount,
  lines,
  participants,
  sortMode,
  onSortChange,
  onChoose,
}: ResultListProps) => {
  if (availableCount === 0) {
    return <p className="text-sm text-stone-500">Coche au moins un participant disponible.</p>;
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {availableCount === 1 ? "Où aller ?" : `Où se retrouver à ${availableCount} ?`}
        </h2>
        <SortSelector value={sortMode} onChange={onSortChange} />
      </div>
      {chosen && (
        <ResultCard
          entry={chosen}
          rank={null}
          lines={lines}
          participants={participants}
          isChosen
          onChoose={() => onChoose(chosen.station.id)}
          onUnchoose={() => onChoose(null)}
        />
      )}
      {chosen && alternatives.length > 0 && (
        <h3 className="mt-1 text-sm font-medium text-stone-500">Alternatives</h3>
      )}
      {alternatives.map((entry, index) => (
        <ResultCard
          key={entry.station.id}
          entry={entry}
          rank={index + 1}
          lines={lines}
          participants={participants}
          isChosen={false}
          onChoose={() => onChoose(entry.station.id)}
          onUnchoose={() => onChoose(null)}
        />
      ))}
    </section>
  );
};

export default ResultList;
