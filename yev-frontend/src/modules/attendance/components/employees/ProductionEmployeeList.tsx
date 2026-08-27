"use client";

import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { AlertTriangle, Inbox } from "lucide-react";

import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { ProductionEmployeeListItemDto, ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";

const PAGE_SIZE = 10;

export interface ProductionEmployeeListHandle {
    refresh: () => void;
}

interface ProductionEmployeeListProps {
    // Nút Nhập/Xuất Excel (do EmployeeList sở hữu dialog/handler) — render ngay trong hàng bộ lọc để
    // không thêm 1 hàng toolbar riêng.
    actions?: ReactNode;
}

// Màn "Nhân viên dưới chuyền" — view riêng đọc thẳng ProductionEmployees, chỉ hiển thị (đọc-only,
// chỉnh dữ liệu qua Import lại file Excel) — xem docs/docs-be/attendance-module.md §Import nhân sự
// dưới chuyền. Bộ lọc dùng đúng 3 dropdown Line/Team/Nhóm ca đã có sẵn cho màn tạo đơn "Theo chuyền".
const ProductionEmployeeList = forwardRef<ProductionEmployeeListHandle, ProductionEmployeeListProps>(function ProductionEmployeeList(
    { actions },
    ref
) {
    const t = useTranslations("Attendance.ProductionEmployeeList");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();

    const [items, setItems] = useState<ProductionEmployeeListItemDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [teamId, setTeamId] = useState<number | "">("");
    const [shiftTeamId, setShiftTeamId] = useState<number | "">("");
    // Lọc theo Bộ phận (2026-08-27, theo yêu cầu người dùng) — ProductionEmployee về lý thuyết không
    // giới hạn cứng chỉ 1 Bộ phận "Chế tạo" (suy qua Employee.Group.DepartmentId, không phải field cố
    // định), nên vẫn cần lọc được như các view Nhân viên khác — mirror EmployeeList.tsx.
    const [departmentId, setDepartmentId] = useState<number | "">("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    useEffect(() => {
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getLineOptions().then(setLineOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getShiftTeamOptions().then(setShiftTeamOptions).catch((err) => console.error(err));
        DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
    }, []);

    const handleSelectDepartment = (nextId: number | "") => {
        setDepartmentId(nextId);
        setPageIndex(1);
    };

    const handleSelectTeam = (nextId: number | "") => {
        setTeamId(nextId);
        setProductionLineId("");
        setPageIndex(1);
        ProductionEmployeeApi.getLineOptions(nextId === "" ? undefined : nextId)
            .then(setLineOptions)
            .catch((err) => console.error(err));
    };

    const handleSelectLine = (nextId: number | "") => {
        setProductionLineId(nextId);
        setPageIndex(1);
    };

    const handleSelectShiftTeam = (nextId: number | "") => {
        setShiftTeamId(nextId);
        setPageIndex(1);
    };

    const departmentSelectOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));
    const lineSelectOptions: SelectOption[] = lineOptions.map((o) => ({ value: o.id, label: o.code, searchText: o.code.toLowerCase() }));
    const teamSelectOptions: SelectOption[] = teamOptions.map((o) => ({
        value: o.id,
        label: o.nameVn ? `${o.code} - ${o.nameVn}` : o.code,
        searchText: o.code.toLowerCase(),
    }));
    const shiftTeamSelectOptions: SelectOption[] = shiftTeamOptions.map((o) => ({
        value: o.id,
        label: o.nameVn ? `${o.code} - ${o.nameVn}` : o.code,
        searchText: o.code.toLowerCase(),
    }));

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            ProductionEmployeeApi.getPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                productionLineId: productionLineId === "" ? undefined : productionLineId,
                teamId: teamId === "" ? undefined : teamId,
                shiftTeamId: shiftTeamId === "" ? undefined : shiftTeamId,
                departmentId: departmentId === "" ? undefined : departmentId,
            }),
        [pageIndex, appliedKeyword, productionLineId, teamId, shiftTeamId, departmentId],
        (result) => {
            setItems(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    useImperativeHandle(ref, () => ({ refresh: refetch }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    return (
        <div>
            <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                        placeholder={t("searchPlaceholder")}
                        className="h-10 w-48 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        {tCommon("search")}
                    </button>
                    <SearchableSelect
                        options={departmentSelectOptions}
                        value={departmentId}
                        onChange={handleSelectDepartment}
                        placeholder={t("filterDepartmentPlaceholder")}
                        triggerClassName="h-10 w-36 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={teamSelectOptions}
                        value={teamId}
                        onChange={handleSelectTeam}
                        placeholder={t("filterTeamPlaceholder")}
                        triggerClassName="h-10 w-32 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={lineSelectOptions}
                        value={productionLineId}
                        onChange={handleSelectLine}
                        placeholder={t("filterBlockPlaceholder")}
                        triggerClassName="h-10 w-28 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={shiftTeamSelectOptions}
                        value={shiftTeamId}
                        onChange={handleSelectShiftTeam}
                        placeholder={t("filterShiftTeamPlaceholder")}
                        triggerClassName="h-10 w-32 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    {actions}
                </div>
                <div className="shrink-0 whitespace-nowrap text-sm text-[#5e3f3a]">
                    {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: items.length, total: totalCount })}
                </div>
            </div>

            {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                    <thead>
                        <tr className="whitespace-nowrap border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                            <th className="px-4 py-2.5">{t("colCode")}</th>
                            <th className="px-4 py-2.5">{t("colFullName")}</th>
                            <th className="px-4 py-2.5">{t("colDepartment")}</th>
                            <th className="px-4 py-2.5">{t("colBlock")}</th>
                            <th className="px-4 py-2.5">{t("colCongDoan")}</th>
                            <th className="px-4 py-2.5">{t("colTeam")}</th>
                            <th className="px-4 py-2.5">{t("colShiftTeam")}</th>
                            <th className="px-4 py-2.5">{t("colTaskName")}</th>
                            <th className="px-4 py-2.5">{t("colLeader")}</th>
                            <th className="px-4 py-2.5">{t("colMonthToDate")}</th>
                            <th className="px-4 py-2.5">{t("colYearToDate")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && items.length === 0 && (
                            <tr>
                                <td colSpan={11} className="px-4 py-12">
                                    <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                        <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                        {t("noData")}
                                    </div>
                                </td>
                            </tr>
                        )}
                        {items.map((item) => {
                            const isMonthOverLimit = item.monthToDate > setting.monthlyOtHourLimit;
                            const isYearOverLimit = item.yearToDate > setting.yearlyOtHourLimit;
                            const accumulationBadgeClass = (overLimit: boolean) =>
                                `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                    overLimit
                                        ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                        : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                }`;
                            return (
                                <tr key={item.id} className="whitespace-nowrap border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-4 py-3 text-sm font-semibold text-[#191c1e]">{item.employeeCode}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.fullName}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.departmentNameVn ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.blockCode ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.congDoan ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.teamNameVn ?? item.teamCode ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.shiftTeamNameVn ?? item.shiftTeamCode ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{item.taskName ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">
                                        {item.isLeader ? (
                                            <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#191c1e]">
                                                {t("leaderYes")}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={accumulationBadgeClass(isMonthOverLimit)}>
                                            {isMonthOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {item.monthToDate}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={accumulationBadgeClass(isYearOverLimit)}>
                                            {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {item.yearToDate}h
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                <button
                    className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                    disabled={!hasPreviousPage || isLoading}
                    onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                >
                    {tCommon("prevPage")}
                </button>
                <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                    {tCommon("pageOf", { current: pageIndex, total: totalPages })}
                </div>
                <button
                    className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                    disabled={!hasNextPage || isLoading}
                    onClick={() => setPageIndex((current) => current + 1)}
                >
                    {tCommon("nextPage")}
                </button>
            </div>
        </div>
    );
});

export default ProductionEmployeeList;
