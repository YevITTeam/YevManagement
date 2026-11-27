import { useTranslations } from "next-intl";

export function TimeRange({ start, end, hours }: { start: string; end: string; hours?: number | string }) {
  const t = useTranslations("Attendance.TimeRange");
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      {start}–{end}
      {end < start && (
        <span title={t("nextDay")} className="text-xs font-semibold text-[#9a5b00]">
          +1
        </span>
      )}
      {hours !== undefined && <span className="ml-0.5 text-[#5e3f3a]">({hours}h)</span>}
    </span>
  );
}
