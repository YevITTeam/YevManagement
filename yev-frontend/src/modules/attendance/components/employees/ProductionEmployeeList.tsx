"use client";

import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { AlertTriangle, History, Inbox, Pencil, SlidersHorizontal, Search } from "lucide-react";

import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { ProductionEmployeeListItemDto, ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import AccumulationHistoryModal from "./AccumulationHistoryModal";
import EmployeeOtLimitDialog from "./EmployeeOtLimitDialog";
import ProductionEmployeeEditDialog from "./ProductionEmployeeEditDialog";

const PAGE_SIZE = 10;

export interface ProductionEmployeeListHandle {
    refresh: () => void;
}

interface ProductionEmployeeListProps {
    // Nút Nhập/Xuất Excel (do EmployeeList sở hữu dialog/handler) — render ngay trong hàng bộ lọc để
    // không thêm 1 hàng toolbar riêng.
    actions?: ReactNode;
    // Công tắc chuyển Nhân viên / Nhân viên dưới chuyền (do EmployeeList sở hữu) — nằm đầu thanh công cụ.
    leading?: ReactNode;
}

// Màn "Nhân viên dưới chuyền" — view riêng đọc thẳng ProductionEmployees. Dữ liệu CẤU TRÚC
// (Line/Team/Nhóm ca) vẫn đọc-only, chỉnh qua Import lại file Excel — xem docs/docs-be/attendance-module.md
// §Import nhân sự dưới chuyền. Riêng lũy kế (Xem lịch sử/Giới hạn OT) sửa được trực tiếp tại đây từ
// 2026-09-04, xem comment ở khối state bên dưới. Bộ lọc dùng đúng 3 dropdown Line/Team/Nhóm ca đã có
// sẵn cho màn tạo đơn "Theo chuyền".
const ProductionEmployeeList = forwardRef<ProductionEmployeeListHandle, ProductionEmployeeListProps>(function ProductionEmployeeList(
    { actions, leading },
    ref
) {
    const t = useTranslations("Attendance.ProductionEmployeeList");
    // Tái dùng nguyên xi text + 2 dialog "Xem lịch sử lũy kế"/"Giới hạn OT" đã có ở EmployeeList.tsx
    // (view "Nhân viên") — cả 2 đều thao tác trên Employee gốc (qua ProductionEmployee.EmployeeId), không
    // đụng dữ liệu cấu trúc ProductionEmployee (Line/Team/Nhóm ca vẫn đọc-only, chỉnh qua Import Excel
    // như cũ) nên đưa thêm vào đây không phá nguyên tắc "màn này chỉ đọc" (2026-09-04, theo yêu cầu
    // người dùng "cho thêm chức năng chỉnh sửa xem lũy kế giống bên văn phòng").
    const tEmployee = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const { user } = useAuth();
    const canUpdateOtLimit = hasPermission(user, "Attendance.Employee.UpdateOtLimit");
    const canUpdateAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Update");
    // Sửa tay Team/Line/Nhóm ca/Trưởng nhóm (2026-09-04) — permission RIÊNG với Import (khác population:
    // Import nạp cả file, Update sửa nhanh 1 người), xem ProductionEmployeeEditDialog.tsx.
    const canUpdateProduction = hasPermission(user, "Attendance.ProductionEmployee.Update");

    const [items, setItems] = useState<ProductionEmployeeListItemDto[]>([]);
    const [historyItem, setHistoryItem] = useState<{ employeeId: number; label: string } | null>(null);
    const [otLimitEmployee, setOtLimitEmployee] = useState<EmployeeDto | null>(null);
    const [loadingOtLimitFor, setLoadingOtLimitFor] = useState<number | null>(null);
    const [editingItem, setEditingItem] = useState<ProductionEmployeeListItemDto | null>(null);

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

    // EmployeeOtLimitDialog cần EmployeeDto đầy đủ (họ/tên tách riêng, giới hạn hiện tại) — dữ liệu
    // dòng ProductionEmployee không có sẵn nên gọi thêm 1 lượt GET đúng lúc bấm, không tải trước cho
    // toàn bộ danh sách.
    const openOtLimitDialog = async (employeeId: number) => {
        setLoadingOtLimitFor(employeeId);
        try {
            const employee = await EmployeeApi.getEmployeeById(employeeId);
            setOtLimitEmployee(employee);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, tEmployee("loadError")));
        } finally {
            setLoadingOtLimitFor(null);
        }
    };

    return (
        <div>
            <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {leading}
                    <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                        placeholder={t("searchPlaceholder")}
                        className="h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                    <SearchableSelect
                        options={departmentSelectOptions}
                        value={departmentId}
                        onChange={handleSelectDepartment}
                        placeholder={t("filterDepartmentPlaceholder")}
                        triggerClassName="h-9 w-24 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={teamSelectOptions}
                        value={teamId}
                        onChange={handleSelectTeam}
                        placeholder={t("filterTeamPlaceholder")}
                        triggerClassName="h-9 w-24 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={lineSelectOptions}
                        value={productionLineId}
                        onChange={handleSelectLine}
                        placeholder={t("filterBlockPlaceholder")}
                        triggerClassName="h-9 w-24 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <SearchableSelect
                        options={shiftTeamSelectOptions}
                        value={shiftTeamId}
                        onChange={handleSelectShiftTeam}
                        placeholder={t("filterShiftTeamPlaceholder")}
                        triggerClassName="h-9 w-24 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                        <tr className="whitespace-nowrap border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.08em] text-[#5e3f3a]">
                            <th className="px-3 py-2">{t("colCode")}</th>
                            <th className="px-3 py-2">{t("colFullName")}</th>
                            <th className="px-3 py-2">{t("colDepartment")}</th>
                            <th className="px-3 py-2">{t("colBlock")}</th>
                            <th className="px-3 py-2">{t("colCongDoan")}</th>
                            <th className="px-3 py-2">{t("colTeam")}</th>
                            <th className="px-3 py-2">{t("colShiftTeam")}</th>
                            <th className="px-3 py-2">{t("colTaskName")}</th>
                            <th className="px-3 py-2">{t("colLeader")}</th>
                            {/* Trước đây nhồi chung 2 badge "T"/"N" vào 1 ô — dễ vỡ layout khi bảng đã có
                                11 cột (badge bị bóp méo, xem phản hồi người dùng 2026-09-28). Tách thành 2
                                cột text riêng, giống cách các bảng OT khác trong module đang hiển thị. */}
                            <th className="whitespace-nowrap px-3 py-2 text-center">{t("colMonthToDate")}</th>
                            <th className="whitespace-nowrap px-3 py-2 text-center">{t("colYearToDate")}</th>
                            <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && items.length === 0 && (
                            <tr>
                                <td colSpan={12} className="px-4 py-12">
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
                            return (
                                <tr key={item.id} className="whitespace-nowrap border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{item.employeeCode}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.fullName}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.departmentNameVn ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.blockCode ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.congDoan ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.teamNameVn ?? item.teamCode ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.shiftTeamNameVn ?? item.shiftTeamCode ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.taskName ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {item.isLeader ? (
                                            <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#191c1e]">
                                                {t("leaderYes")}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                    <td
                                        className={`whitespace-nowrap px-3 py-2 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {isMonthOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {item.monthToDate}h
                                        </span>
                                    </td>
                                    <td
                                        className={`whitespace-nowrap px-3 py-2 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {item.yearToDate}h
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        {item.employeeId !== null && (
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() => setHistoryItem({ employeeId: item.employeeId!, label: `${item.fullName} (${item.employeeCode})` })}
                                                    className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    title={tEmployee("viewAccumulationHistory")}
                                                    aria-label={tEmployee("viewAccumulationHistory")}
                                                >
                                                    <History className="h-3.5 w-3.5" />
                                                </button>
                                                {canUpdateOtLimit && (
                                                    <button
                                                        onClick={() => openOtLimitDialog(item.employeeId!)}
                                                        disabled={loadingOtLimitFor === item.employeeId}
                                                        className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:opacity-50"
                                                        title={tEmployee("otLimitEditAction")}
                                                        aria-label={tEmployee("otLimitEditAction")}
                                                    >
                                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                {canUpdateProduction && (
                                                    <button
                                                        onClick={() => setEditingItem(item)}
                                                        className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                        title={t("editAction")}
                                                        aria-label={t("editAction")}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
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

            {historyItem && (
                <AccumulationHistoryModal
                    employeeId={historyItem.employeeId}
                    employeeLabel={historyItem.label}
                    canEdit={canUpdateAccumulation}
                    onClose={() => setHistoryItem(null)}
                />
            )}

            <EmployeeOtLimitDialog
                employee={otLimitEmployee}
                onClose={() => setOtLimitEmployee(null)}
                onSaved={() => {
                    setOtLimitEmployee(null);
                    refetch();
                }}
            />

            <ProductionEmployeeEditDialog
                item={editingItem}
                onClose={() => setEditingItem(null)}
                onSaved={() => {
                    setEditingItem(null);
                    refetch();
                }}
            />
        </div>
    );
});

export default ProductionEmployeeList;
