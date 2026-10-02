"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

// Clamps to [0, max] ONLY when the typed number exceeds it — the typed digits are otherwise kept
// verbatim (no Number -> String round-trip, which would turn "05" into "5" while the user is looking
// at it). No zero-padding mid-typing (e.g. "1" on the way to "14"); padding happens on blur.
function clampDigits(raw: string, max: number): string {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (digits === "") return "";
    return Number(digits) > max ? String(max) : digits;
}

// Hour/minute typed as plain numbers, in ONE shared border. Built by hand instead of
// <input type="time"> on purpose: browsers (Firefox especially) ignore the lang attribute and render
// that control in the OS locale format, which can come out as AM/PM and gets clipped in a narrow box.
// This one always reads and writes 24h, whatever the browser or OS is set to.
// Value shape is "HH:mm"; callers holding BE's "HH:mm:ss" trim/re-append at their own boundary.
export default function TimePicker24h({
    value,
    onChange,
    disabled,
    compact = false,
    required = true,
    hourLabel,
    minuteLabel,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    // Smaller variant for the per-employee hour cells in long OT tables.
    compact?: boolean;
    required?: boolean;
    hourLabel?: string;
    minuteLabel?: string;
}) {
    const t = useTranslations("Common");
    const minuteRef = useRef<HTMLInputElement>(null);
    const [hour, minute] = value ? value.split(":") : ["", ""];
    const hourText = hourLabel ?? t("hourPlaceholder");
    const minuteText = minuteLabel ?? t("minutePlaceholder");

    const commitHour = (nextHour: string) => onChange(`${nextHour}:${minute}`);
    const commitMinute = (nextMinute: string) => onChange(`${hour}:${nextMinute}`);

    // Numbers sit borderless inside one frame so the pair reads as a single time field; the border and
    // focus ring belong to the frame (focus-within).
    const segmentClassName = `bg-transparent text-center font-medium tabular-nums text-[#191c1e] outline-none placeholder:text-[#c7ccd1] disabled:cursor-not-allowed ${
        compact ? "w-8 text-xs" : "w-10 text-sm"
    }`;

    return (
        <div
            className={`inline-flex items-center rounded-md border border-[#e0e3e5] bg-white transition focus-within:border-[#e3000f] focus-within:ring-2 focus-within:ring-[#ffe0e3] has-[:disabled]:bg-[#f8fafc] ${
                compact ? "h-7 gap-0.5 px-1.5" : "h-9 gap-1 rounded-lg px-2.5"
            }`}
        >
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={hour}
                onChange={(event) => {
                    const next = clampDigits(event.target.value, 23);
                    commitHour(next);
                    // Two digits typed -> jump to the minute box.
                    if (next.length === 2 && event.target.value.length >= 2) minuteRef.current?.focus();
                }}
                // Read the DOM value, not the `hour` closure: auto-advance calls minuteRef.focus() inside onChange,
                // which fires this blur BEFORE re-render — the stale closure ("1") would overwrite the typed "14".
                onBlur={(event) => {
                    const typed = event.currentTarget.value;
                    if (typed !== "" && typed.length < 2) commitHour(typed.padStart(2, "0"));
                }}
                onFocus={(event) => event.target.select()}
                // Enter moves to the minute box instead of submitting the form.
                onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    minuteRef.current?.focus();
                }}
                disabled={disabled}
                required={required}
                placeholder={hourText}
                aria-label={hourText}
                className={segmentClassName}
            />
            <span className="text-xs font-semibold text-[#8a8f94]">:</span>
            <input
                ref={minuteRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={minute}
                onChange={(event) => commitMinute(clampDigits(event.target.value, 59))}
                onBlur={(event) => {
                    const typed = event.currentTarget.value;
                    if (typed !== "" && typed.length < 2) commitMinute(typed.padStart(2, "0"));
                }}
                onFocus={(event) => event.target.select()}
                onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    event.currentTarget.blur();
                }}
                disabled={disabled}
                required={required}
                placeholder={minuteText}
                aria-label={minuteText}
                className={segmentClassName}
            />
        </div>
    );
}
