"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { History, Inbox, Search } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import AccumulationHistoryModal from "./AccumulationHistoryModal";

const PAGE_SIZE = 10;

// For approvers to look up accumulation without opening a form; the list is scoped by BE from the caller's
// job-title tree, so there is no department/group picker.
export default function AccumulationLookupPage() {
    const t = useTranslations("Attendance.AccumulationHistory");
    const tCommon = useTranslations("Common");

    const { user } = useAuth();
    const canUpdateAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Update");
    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [pageIndex, setPageIndex] = useState(1);
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDto | null>(null);

    // Reset to page 1 on keyword change by comparing a snapshot during render instead of an effect.
    const [prevAppliedKeyword, setPrevAppliedKeyword] = useState(appliedKeyword);
    if (prevAppliedKeyword !== appliedKeyword) {
        setPrevAppliedKeyword(appliedKeyword);
        setPageIndex(1);
    }

    const { isLoading, error } = useFetchEffect(
        () => EmployeeApi.getInMyScope({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadEmployeesError"),
        (message) => toast.error(message)
    );

    const handleSearch = () => setAppliedKeyword(keyword.trim());

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("pageTitle")}</h1>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title={tCommon("search")}
                            aria-label={tCommon("search")}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50 inline-flex h-9 w-9 shrink-0 items-center justify-center"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: employees.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colFullName")}</th>
                                <th className="px-3 py-2">{t("colOrgUnit")}</th>
                                <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && employees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noEmployees")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {employees.map((employee) => (
                                <tr key={employee.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {employee.groupNameVn ?? employee.departmentNameVn ?? (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        <button
                                            onClick={() => setSelectedEmployee(employee)}
                                            className="cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                            title={t("viewButtonLabel")}
                                        >
                                            <History className="h-3.5 w-3.5" />
                                            {t("viewButtonLabel")}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-3">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        {tCommon("prevPage")}
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">{pageIndex}</div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        {tCommon("nextPage")}
                    </button>
                </div>
            </section>

            {selectedEmployee && (
                <AccumulationHistoryModal
                    employeeId={selectedEmployee.id}
                    employeeLabel={`${selectedEmployee.lastName} ${selectedEmployee.firstName} (${selectedEmployee.code})`}
                    canEdit={canUpdateAccumulation}
                    onClose={() => setSelectedEmployee(null)}
                />
            )}
        </div>
    );
}
