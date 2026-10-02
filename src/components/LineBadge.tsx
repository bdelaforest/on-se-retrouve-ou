import type { LineStyle } from "../types";

interface LineBadgeProps {
  line: string;
  style: LineStyle | undefined;
}

const LineBadge = ({ line, style }: LineBadgeProps) => {
  const shape = style?.mode === "rer" ? "rounded-sm" : "rounded-full";
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center px-1 text-[11px] font-bold leading-none ${shape}`}
      style={{ backgroundColor: style?.color ?? "#888", color: style?.textColor ?? "#fff" }}
      title={style?.mode === "rer" ? `RER ${line}` : `Métro ${line}`}
    >
      {line}
    </span>
  );
};

export default LineBadge;
