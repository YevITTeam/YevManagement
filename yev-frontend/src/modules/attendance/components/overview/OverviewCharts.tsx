"use client";

// Dependency-free charts for the OT overview: flex bars and a conic-gradient donut.
export interface ChartDatum {
    label: string;
    value: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#191c1e]">{title}</h2>
                {hint && <span className="text-[11px] text-[#8a8f94]">{hint}</span>}
            </div>
            {children}
        </section>
    );
}

export function EmptyChart({ text }: { text: string }) {
    return <div className="flex h-32 items-center justify-center text-sm text-[#8a8f94]">{text}</div>;
}

// Vertical bars; `limit` draws a dashed reference line. Labels are thinned out when there are many bars.
export function BarChart({ data, color = "#3b82f6", highlightIndex, limit }: { data: ChartDatum[]; color?: string; highlightIndex?: number; limit?: number }) {
    const max = Math.max(...data.map((d) => d.value), limit ?? 0, 1);
    const labelEvery = data.length > 14 ? 5 : 1;

    return (
        <div>
            <div className="relative flex h-40 items-end gap-0.5">
                {limit !== undefined && (
                    <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#e3000f]" style={{ bottom: `${(limit / max) * 100}%` }} />
                )}
                {data.map((d, i) => (
                    <div key={d.label} title={`${d.label}: ${round(d.value)}h`} className="flex h-full min-w-0 flex-1 items-end">
                        <div
                            className="w-full rounded-t-sm transition-[height]"
                            style={{
                                height: `${(d.value / max) * 100}%`,
                                minHeight: d.value > 0 ? 2 : 0,
                                backgroundColor: i === highlightIndex ? "#2563eb" : color,
                            }}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-1 flex gap-0.5">
                {data.map((d, i) => (
                    <div key={d.label} className="min-w-0 flex-1 text-center text-[10px] text-[#8a8f94]">
                        {i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Horizontal bars with the value (and an optional badge) on the right.
export function HBarList({ rows, color = "#3b82f6" }: { rows: (ChartDatum & { badge?: string })[]; color?: string }) {
    const max = Math.max(...rows.map((r) => r.value), 1);

    return (
        <div className="space-y-2">
            {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
                    <span className="truncate text-[#191c1e]" title={row.label}>
                        {row.label}
                    </span>
                    <div className="h-2.5 rounded-full bg-[#f2f4f6]">
                        <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: color }} />
                    </div>
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#191c1e]">
                        {round(row.value)}h
                        {row.badge && <span className="rounded-full bg-[#fff4f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#930006]">{row.badge}</span>}
                    </span>
                </div>
            ))}
        </div>
    );
}

export interface DonutSlice {
    label: string;
    value: number;
    color: string;
}

export function Donut({ slices }: { slices: DonutSlice[] }) {
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    let angle = 0;
    const stops = slices
        .filter((s) => s.value > 0)
        .map((s) => {
            const start = angle;
            angle += (s.value / total) * 360;
            return `${s.color} ${start}deg ${angle}deg`;
        })
        .join(", ");

    return (
        <div className="flex items-center gap-4">
            <div
                className="relative h-28 w-28 shrink-0 rounded-full"
                style={{ background: total > 0 ? `conic-gradient(${stops})` : "#f2f4f6" }}
                role="img"
                aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ")}
            >
                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-lg font-semibold text-[#191c1e]">{total}</div>
            </div>
            <ul className="min-w-0 space-y-1.5 text-xs">
                {slices.map((s) => (
                    <li key={s.label} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="truncate text-[#5e3f3a]">{s.label}</span>
                        <span className="font-semibold text-[#191c1e]">{s.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
