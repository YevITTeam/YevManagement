import { ArrowRight } from "lucide-react";

export function TimeRange({ start, end, hours }: { start: string; end: string; hours?: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span>{start}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#8a8f94]" aria-hidden />
      <span>{end}</span>
      {hours !== undefined && (
        <span className="ml-0.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-semibold text-[#5e3f3a]">
          {hours}h
        </span>
      )}
    </span>
  );
}
