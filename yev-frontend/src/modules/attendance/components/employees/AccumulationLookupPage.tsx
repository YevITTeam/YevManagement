"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { History, Search } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import AccumulationHistoryModal from "./AccumulationHistoryModal";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, IconButton, ListToolbar, SearchField, TableStatusRows, rowClassName, theadRowClassName } from "@/components/ui/ListToolbar";

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
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/employees/AccumulationLookupPage", PAGE_SIZE);
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDto | null>(null);

    // Reset to page 1 on keyword change by comparing a snapshot during render instead of an effect.
    const [prevAppliedKeyword, setPrevAppliedKeyword] = useState(appliedKeyword);
    if (prevAppliedKeyword !== appliedKeyword) {
        setPrevAppliedKeyword(appliedKeyword);
        setPageIndex(1);
    }

    const { isLoading, error } = useFetchEffect(
        () => EmployeeApi.getInMyScope({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
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
                <ListToolbar>
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} wide />
                    <IconButton icon={Search} label={tCommon("search")} onClick={handleSearch} disabled={isLoading} variant="primary" />
                </ListToolbar>

                <ErrorBar message={error} />

                <TableScroll className="relative">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colFullName")}</th>
                                <th className="px-3 py-2">{t("colOrgUnit")}</th>
                                <th className="w-10 px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={employees.length === 0} columns={4} emptyText={t("noEmployees")} />
                            {employees.map((employee) => (
                                <tr key={employee.id} onClick={() => setSelectedEmployee(employee)} className={`${rowClassName} cursor-pointer`}>
                                    <td className="px-3 py-2 font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-3 py-2 text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-3 py-2 text-[#5e3f3a]">
                                        {employee.groupNameVn ?? employee.departmentNameVn ?? (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1 text-right">
                                        <IconButton icon={History} label={t("viewButtonLabel")} onClick={() => setSelectedEmployee(employee)} variant="ghost" size="sm" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScroll>

                <Pagination
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: employees.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            {selectedEmployee && (
                <AccumulationHistoryModal
                    employeeId={selectedEmployee.id}
                    employeeLabel={`${selectedEmployee.lastName} ${selectedEmployee.firstName} (${selectedEmployee.code})`}
                    monthlyLimit={selectedEmployee.customMonthlyOtHourLimit}
                    yearlyLimit={selectedEmployee.customYearlyOtHourLimit}
                    canEdit={canUpdateAccumulation}
                    onClose={() => setSelectedEmployee(null)}
                />
            )}
        </div>
    );
}
