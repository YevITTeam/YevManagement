"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ClipboardList, Clock, Users } from "lucide-react";

import { OtOverviewApi } from "@/modules/attendance/api/ot-overview.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { OtOverviewDto, OtOverviewEmployeeRowDto } from "@/modules/attendance/types/ot-overview.dto";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import { formatHours } from "@/modules/attendance/lib/time";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { BarChart, ChartCard, Donut, EmptyChart, HBarList } from "./OverviewCharts";

const now = new Date();
const CURRENT_PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const RISK_PAGE_SIZE = 10;

function KpiCard({ icon, label, value, sub, tone = "default" }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "danger" }) {
    return (
        <div className={`rounded-xl border p-4 shadow-sm ${tone === "danger" ? "border-[#e9bcb6] bg-[#fff4f2]" : "border-[#e0e3e5] bg-white"}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                {icon}
                {label}
            </div>
            <div className={`mt-2 text-2xl font-semibold ${tone === "danger" ? "text-[#930006]" : "text-[#191c1e]"}`}>{value}</div>
            {sub && <div className="mt-1 text-xs text-[#5e3f3a]">{sub}</div>}
        </div>
    );
}

function LimitBar({ value, limit, over }: { value: number; limit: number; over: boolean }) {
    const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
    return (
        <div className="min-w-28">
            <div className={`text-xs font-semibold ${over ? "text-[#930006]" : "text-[#191c1e]"}`}>
                {formatHours(value)} / {formatHours(limit)}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#f2f4f6]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? "#e3000f" : pct >= 80 ? "#f59e0b" : "#16a34a" }} />
            </div>
        </div>
    );
}

export default function OtOverviewPage() {
    const t = useTranslations("Attendance.OtOverview");
    const tAcc = useTranslations("Attendance.AccumulationHistory");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const enumLabels = useEnumLabels();

    const [period, setPeriod] = useState(CURRENT_PERIOD);
    const [workshopId, setWorkshopId] = useState<number | "">("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [data, setData] = useState<OtOverviewDto | null>(null);
    const [riskPage, setRiskPage] = useState(1);

    const [year, month] = period.split("-").map(Number);
    const pick = (vn: string, jp: string | null | undefined) => (locale === "ja" && jp ? jp : vn);

    useFetchEffect(() => WorkshopApi.getAllWorkshops(), [], setWorkshops, t("loadError"));
    const { isLoading, error } = useFetchEffect(
        () => OtOverviewApi.get(year, month, workshopId === "" ? undefined : workshopId),
        [year, month, workshopId],
        setData,
        t("loadError"),
        (message) => toast.error(message)
    );

    const delta = data && data.previousMonthHours > 0 ? Math.round(((data.monthHours - data.previousMonthHours) / data.previousMonthHours) * 100) : null;

    const riskEmployees = data?.riskEmployees ?? [];
    const riskTotalPages = Math.max(1, Math.ceil(riskEmployees.length / RISK_PAGE_SIZE));
    const currentRiskPage = Math.min(riskPage, riskTotalPages);
    const riskRows = riskEmployees.slice((currentRiskPage - 1) * RISK_PAGE_SIZE, currentRiskPage * RISK_PAGE_SIZE);

    const renderRiskRow =(row: OtOverviewEmployeeRowDto) => (
        <tr key={row.employeeId} className="border-b border-[#f1f5f9] last:border-0">
            <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{row.code}</td>
            <td className="px-3 py-2 text-sm font-medium text-[#191c1e]">{row.fullName}</td>
            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.departmentNameVn ? pick(row.departmentNameVn, row.departmentNameJp) : "-"}</td>
            <td className="px-3 py-2">
                <LimitBar value={row.monthHours} limit={row.monthlyLimit} over={row.isOverMonthly} />
            </td>
            <td className="px-3 py-2">
                <LimitBar value={row.yearHours} limit={row.yearlyLimit} over={row.isOverYearly} />
            </td>
        </tr>
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("pageTitle")}</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {workshops.length > 1 && (
                        <div className="w-44">
                            <SearchableSelect
                                value={workshopId}
                                onChange={setWorkshopId}
                                placeholder={t("allWorkshops")}
                                options={workshops.map((w) => ({ value: w.id, label: pick(w.workshopNameVn, w.workshopNameJp), searchText: w.workshopNameVn.toLowerCase() }))}
                            />
                        </div>
                    )}
                    <input
                        type="month"
                        value={period}
                        max={CURRENT_PERIOD}
                        onChange={(event) => event.target.value && setPeriod(event.target.value)}
                        aria-label={t("filterMonth")}
                        className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                </div>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}
            {isLoading && !data && <div className="py-12 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>}

            {data && (
                <div className={`space-y-4 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard icon={<Users className="h-4 w-4" />} label={t("kpiEmployees")} value={data.employeeCount} />
                        <KpiCard
                            icon={<Clock className="h-4 w-4" />}
                            label={t("kpiMonthHours")}
                            value={formatHours(data.monthHours)}
                            sub={delta !== null ? t("kpiVsPrevious", { delta: `${delta > 0 ? "+" : ""}${delta}%` }) : undefined}
                        />
                        <KpiCard
                            icon={<ClipboardList className="h-4 w-4" />}
                            label={t("kpiForms")}
                            value={data.formsCompleted + data.formsInApproval + data.formsRejected}
                            sub={`${enumLabels.otFormStatus[1]} ${data.formsCompleted} · ${enumLabels.otFormStatus[0]} ${data.formsInApproval} · ${enumLabels.otFormStatus[2]} ${data.formsRejected}`}
                        />
                        <KpiCard
                            icon={<AlertTriangle className="h-4 w-4" />}
                            tone={data.overAnyCount > 0 ? "danger" : "default"}
                            label={t("kpiOverLimit")}
                            value={data.overAnyCount}
                            sub={t("kpiOverLimitSub", { monthly: data.overMonthlyCount, yearly: data.overYearlyCount, near: data.nearLimitCount })}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        <ChartCard title={t("chartDaily")} hint={t("chartDailyHint")}>
                            <BarChart data={data.dailyHours.map((d) => ({ label: String(Number(d.date.slice(8, 10))), value: d.hours }))} color="#3b82f6" />
                        </ChartCard>
                        <ChartCard title={t("chartTrend", { year: data.year })} hint={t("chartTrendHint")}>
                            <BarChart
                                data={data.monthlyTrend.map((m) => ({ label: tAcc("monthShort", { month: m.month }), value: m.hours }))}
                                color="#93c5fd"
                                highlightIndex={data.month - 1}
                            />
                        </ChartCard>
                        <ChartCard title={t("chartStatus")}>
                            <Donut
                                slices={[
                                    { label: enumLabels.otFormStatus[1], value: data.formsCompleted, color: "#16a34a" },
                                    { label: enumLabels.otFormStatus[0], value: data.formsInApproval, color: "#f59e0b" },
                                    { label: enumLabels.otFormStatus[2], value: data.formsRejected, color: "#dc2626" },
                                ]}
                            />
                        </ChartCard>
                        <ChartCard title={t("chartOtCase")}>
                            {data.byOtCase.length === 0 ? (
                                <EmptyChart text={t("empty")} />
                            ) : (
                                <Donut slices={data.byOtCase.map((c, i) => ({ label: c.code, value: c.formCount, color: ["#3b82f6", "#8b5cf6", "#14b8a6", "#ec4899", "#f97316", "#64748b"][i % 6] }))} />
                            )}
                        </ChartCard>
                        {/* Without the workshop chart the department bars take the leftover slots so no card sits alone on a row. */}
                        <ChartCard
                            title={t("chartDepartment")}
                            hint={t("chartDailyHint")}
                            className={data.byWorkshop.length > 1 ? "" : "lg:col-span-2"}
                        >
                            {data.byDepartment.length === 0 ? (
                                <EmptyChart text={t("empty")} />
                            ) : (
                                <HBarList
                                    rows={data.byDepartment.slice(0, 10).map((d) => ({
                                        label: pick(d.nameVn, d.nameJp),
                                        value: d.hours,
                                        badge: d.overLimitCount > 0 ? t("overBadge", { count: d.overLimitCount }) : undefined,
                                    }))}
                                />
                            )}
                        </ChartCard>
                        {data.byWorkshop.length > 1 && (
                            <ChartCard title={t("chartWorkshop")} hint={t("chartDailyHint")}>
                                <HBarList rows={data.byWorkshop.map((w) => ({ label: pick(w.nameVn, w.nameJp), value: w.hours }))} />
                            </ChartCard>
                        )}
                    </div>

                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#191c1e]">{t("riskTitle")}</div>
                        {data.riskEmployees.length === 0 ? (
                            <EmptyChart text={t("empty")} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                            <th className="px-3 py-2">{t("colCode")}</th>
                                            <th className="px-3 py-2">{t("colName")}</th>
                                            <th className="px-3 py-2">{t("colDepartment")}</th>
                                            <th className="px-3 py-2">{t("colMonth")}</th>
                                            <th className="px-3 py-2">{t("colYear")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>{riskRows.map(renderRiskRow)}</tbody>
                                </table>
                            </div>
                        )}
                        {data.riskEmployees.length > RISK_PAGE_SIZE && (
                            <Pagination
                                pageIndex={currentRiskPage}
                                totalPages={riskTotalPages}
                                onPageChange={setRiskPage}
                                summary={tCommon("showingRecords", { shown: riskRows.length, total: data.riskEmployees.length })}
                                compactSummary={data.riskEmployees.length}
                            />
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
