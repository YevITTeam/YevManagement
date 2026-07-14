"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";

import type { SchedulePlan } from "../types/schedule";
import { addDays, diffDays, formatShort, formatVN, parseDate, toISODate, todayUTC } from "../lib/date";

interface ScheduleGanttProps {
  plans: SchedulePlan[];
  // Gọi khi kéo/thả xong 1 bar để đổi ngày. startISO/endISO là "YYYY-MM-DD".
  onChangeDates: (planId: string, startISO: string, endISO: string) => void;
}

const LABEL_WIDTH = 176; // px — cột tên kế hoạch bên trái
const ROW_HEIGHT = 44; // px — chiều cao mỗi hàng

type DragMode = "move" | "start" | "end";

// Chọn bước chia mốc trục ngang cho dễ đọc theo độ dài tổng.
const pickTickStep = (totalDays: number): number => {
  if (totalDays <= 14) return 1;
  if (totalDays <= 30) return 3;
  if (totalDays <= 90) return 7;
  if (totalDays <= 365) return 30;
  return 60;
};

export default function ScheduleGantt({ plans, onChangeDates }: ScheduleGanttProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  // Đo bề rộng vùng timeline (không gồm cột tên) để quy đổi px ↔ ngày.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Lọc các kế hoạch có ngày hợp lệ để dựng miền thời gian.
  const dated = plans
    .map((plan) => {
      const start = parseDate(plan.startDate);
      const end = parseDate(plan.endDate);
      return start && end && diffDays(start, end) >= 0 ? { plan, start, end } : null;
    })
    .filter((item): item is { plan: SchedulePlan; start: Date; end: Date } => item !== null);

  if (dated.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e0e3e5] bg-white p-6 text-center text-sm text-[#5e3f3a]">
        Thêm <strong>ngày bắt đầu</strong> và <strong>ngày kết thúc</strong> cho kế hoạch để xem biểu đồ thời gian.
      </div>
    );
  }

  // Miền thời gian = [min start, max end] + đệm 2 bên để có chỗ kéo dài bar.
  const minStart = dated.reduce((acc, item) => (item.start < acc ? item.start : acc), dated[0].start);
  const maxEnd = dated.reduce((acc, item) => (item.end > acc ? item.end : acc), dated[0].end);
  const rawSpan = diffDays(minStart, maxEnd) + 1;
  const pad = Math.max(3, Math.round(rawSpan * 0.15));
  const domainStart = addDays(minStart, -pad);
  const domainEnd = addDays(maxEnd, pad);
  const totalDays = diffDays(domainStart, domainEnd) + 1;
  const dayWidth = trackWidth > 0 ? trackWidth / totalDays : 0;

  // Mốc trục ngang.
  const step = pickTickStep(totalDays);
  const ticks: { offset: number; label: string }[] = [];
  for (let offset = 0; offset < totalDays; offset += step) {
    ticks.push({ offset, label: formatShort(addDays(domainStart, offset)) });
  }

  const today = todayUTC();
  const todayOffset = diffDays(domainStart, today);
  const todayInRange = todayOffset >= 0 && todayOffset < totalDays;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#191c1e]">
          <CalendarClock className="h-4 w-4 text-[#e3000f]" /> Biểu đồ thời gian
        </h2>
        <span className="hidden text-xs text-[#5e3f3a] sm:block">Kéo thân bar để dời, kéo hai mép để đổi ngày</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Trục ngày */}
          <div className="flex border-b border-[#e0e3e5]">
            <div className="shrink-0 border-r border-[#e0e3e5]" style={{ width: LABEL_WIDTH }} />
            <div ref={trackRef} className="relative h-8 flex-1">
              {dayWidth > 0 &&
                ticks.map((tick) => (
                  <div
                    key={tick.offset}
                    className="absolute top-0 flex h-full items-center border-l border-[#eef1f3] pl-1 text-[11px] text-[#5e3f3a]"
                    style={{ left: tick.offset * dayWidth }}
                  >
                    {tick.label}
                  </div>
                ))}
              {dayWidth > 0 && todayInRange && (
                <div
                  className="absolute top-0 h-full border-l-2 border-[#e3000f]/50"
                  style={{ left: todayOffset * dayWidth }}
                  title="Hôm nay"
                />
              )}
            </div>
          </div>

          {/* Các hàng kế hoạch */}
          {plans.map((plan) => {
            const start = parseDate(plan.startDate);
            const end = parseDate(plan.endDate);
            const valid = start && end && diffDays(start, end) >= 0;
            return (
              <div key={plan.id} className="flex border-b border-[#f1f5f9] last:border-b-0">
                <div
                  className="flex shrink-0 items-center border-r border-[#e0e3e5] px-3 text-sm font-medium text-[#191c1e]"
                  style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                >
                  <span className="truncate" title={plan.name}>
                    {plan.name || "(Chưa đặt tên)"}
                  </span>
                </div>
                <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                  {/* nền today để căn thẳng với trục */}
                  {dayWidth > 0 && todayInRange && (
                    <div
                      className="pointer-events-none absolute top-0 h-full border-l-2 border-[#e3000f]/20"
                      style={{ left: todayOffset * dayWidth }}
                    />
                  )}
                  {valid && dayWidth > 0 ? (
                    <GanttBar
                      key={`${plan.startDate}-${plan.endDate}`}
                      startOffset={diffDays(domainStart, start)}
                      span={diffDays(start, end) + 1}
                      dayWidth={dayWidth}
                      totalDays={totalDays}
                      startDate={start}
                      endDate={end}
                      progress={
                        plan.tasks.length > 0
                          ? plan.tasks.filter((task) => task.status === "done").length / plan.tasks.length
                          : 0
                      }
                      onCommit={(startOffset, endOffset) => {
                        const newStart = toISODate(addDays(domainStart, startOffset));
                        const newEnd = toISODate(addDays(domainStart, endOffset));
                        if (newStart !== plan.startDate || newEnd !== plan.endDate) {
                          onChangeDates(plan.id, newStart, newEnd);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center pl-2 text-xs italic text-[#9aa0a6]">Chưa đặt ngày</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface GanttBarProps {
  startOffset: number; // số ngày từ domainStart tới ngày bắt đầu
  span: number; // số ngày của kế hoạch (>= 1)
  dayWidth: number;
  totalDays: number;
  startDate: Date;
  endDate: Date;
  progress: number; // tỉ lệ task hoàn thành 0..1
  onCommit: (startOffset: number, endOffset: number) => void;
}

function GanttBar({ startOffset, span, dayWidth, totalDays, startDate, endDate, progress, onCommit }: GanttBarProps) {
  const [drag, setDrag] = useState<{ mode: DragMode; deltaDays: number } | null>(null);

  const clamp = (value: number) => Math.max(0, Math.min(value, totalDays - 1));

  // Vị trí hiển thị (kèm preview khi đang kéo).
  let previewStart = startOffset;
  let previewEnd = startOffset + span - 1;
  if (drag) {
    if (drag.mode === "move") {
      previewStart += drag.deltaDays;
      previewEnd += drag.deltaDays;
    } else if (drag.mode === "start") {
      previewStart = Math.min(previewStart + drag.deltaDays, previewEnd);
    } else {
      previewEnd = Math.max(previewEnd + drag.deltaDays, previewStart);
    }
  }
  previewStart = clamp(previewStart);
  previewEnd = clamp(previewEnd);

  const beginDrag = (mode: DragMode) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;

    const computeDelta = (clientX: number) => Math.round((clientX - startX) / dayWidth);

    const onMove = (moveEvent: PointerEvent) => setDrag({ mode, deltaDays: computeDelta(moveEvent.clientX) });

    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const deltaDays = computeDelta(upEvent.clientX);
      setDrag(null);
      if (deltaDays === 0) return;

      let newStart = startOffset;
      let newEnd = startOffset + span - 1;
      if (mode === "move") {
        newStart += deltaDays;
        newEnd += deltaDays;
      } else if (mode === "start") {
        newStart = Math.min(newStart + deltaDays, newEnd);
      } else {
        newEnd = Math.max(newEnd + deltaDays, newStart);
      }
      onCommit(clamp(newStart), clamp(newEnd));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const previewStartDate = drag ? addDays(startDate, previewStart - startOffset) : startDate;
  const previewEndDate = drag ? addDays(endDate, previewEnd - (startOffset + span - 1)) : endDate;

  return (
    <div
      className="group absolute top-1/2 flex -translate-y-1/2 items-center rounded-md bg-[#e3000f] text-white shadow-sm"
      style={{
        left: previewStart * dayWidth,
        width: Math.max((previewEnd - previewStart + 1) * dayWidth, 6),
        height: ROW_HEIGHT - 16,
      }}
      title={`${formatVN(previewStartDate)} → ${formatVN(previewEndDate)}`}
    >
      {/* mép trái: đổi ngày bắt đầu */}
      <span
        onPointerDown={beginDrag("start")}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-md bg-black/15 opacity-0 transition group-hover:opacity-100"
      />
      {/* thân: dời cả bar */}
      <span
        onPointerDown={beginDrag("move")}
        className="flex-1 cursor-grab select-none truncate px-2 text-[11px] font-semibold leading-none active:cursor-grabbing"
      >
        {formatShort(previewStartDate)} – {formatShort(previewEndDate)}
      </span>
      {/* mép phải: đổi ngày kết thúc */}
      <span
        onPointerDown={beginDrag("end")}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-black/15 opacity-0 transition group-hover:opacity-100"
      />
      {/* thanh tiến độ hoàn thành task */}
      <span className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full overflow-hidden rounded-b-md bg-white/25">
        <span className="block h-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
    </div>
  );
}
