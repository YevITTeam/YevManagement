"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { DeviceGroupApi } from "@/modules/pc-management/api/device-group.api";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import DeviceGroupForm, { type DeviceGroupFormValues } from "./DeviceGroupForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

export default function DeviceGroupList() {
    const t = useTranslations("Asset.DeviceGroup");
    const tCommon = useTranslations("Common");
    const [deviceGroups, setDeviceGroups] = useState<DeviceGroupDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [departments, setDepartments] = useState<DeviceDepartmentDto[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingDeviceGroup, setEditingDeviceGroup] = useState<DeviceGroupDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingDeviceGroup, setDeletingDeviceGroup] = useState<DeviceGroupDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchDeviceGroups } = useFetchEffect(
        () =>
            DeviceGroupApi.getDeviceGroupPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                departmentId: departmentFilter ? Number(departmentFilter) : undefined,
            }),
        [pageIndex, appliedKeyword, departmentFilter],
        (result) => {
            setDeviceGroups(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message),
        "device-groups"
    );

    useEffect(() => {
        DeviceDepartmentApi.getAllDeviceDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
    }, []);

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingDeviceGroup(null);
        setFormOpen(true);
    };

    const openEditForm = (deviceGroup: DeviceGroupDto) => {
        setFormMode("edit");
        setEditingDeviceGroup(deviceGroup);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingDeviceGroup(null);
    };

    const handleSubmitForm = async (values: DeviceGroupFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await DeviceGroupApi.createDeviceGroup(values);
                toast.success(t("createSuccess"));
            } else if (editingDeviceGroup) {
                await DeviceGroupApi.updateDeviceGroup(editingDeviceGroup.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingDeviceGroup(null);
            await fetchDeviceGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingDeviceGroup) return;
        setIsDeleting(true);
        try {
            await DeviceGroupApi.deleteDeviceGroup(deletingDeviceGroup.id);
            toast.success(t("deleteSuccess"));
            setDeletingDeviceGroup(null);
            await fetchDeviceGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentName,
        searchText: d.departmentName.toLowerCase(),
    }));

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchDeviceGroups()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        + {tCommon("add")}
                    </button>
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentFilter === "" ? "" : Number(departmentFilter)}
                            onChange={(v) => {
                                setPageIndex(1);
                                setDepartmentFilter(v === "" ? "" : String(v));
                            }}
                            placeholder={t("allDepartmentsOption")}
                            triggerClassName="h-10 w-56 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: deviceGroups.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">{t("colCode")}</th>
                                <th className="px-6 py-3">{t("colName")}</th>
                                <th className="px-6 py-3">{t("colDepartment")}</th>
                                <th className="px-6 py-3 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && deviceGroups.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("noData")}
                                    </td>
                                </tr>
                            )}
                            {deviceGroups.map((deviceGroup) => (
                                <tr key={deviceGroup.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{deviceGroup.id}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{deviceGroup.groupCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{deviceGroup.groupName}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{deviceGroup.departmentName}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(deviceGroup)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title={tCommon("edit")}
                                            >
                                                {tCommon("edit")}
                                            </button>
                                            <button
                                                onClick={() => setDeletingDeviceGroup(deviceGroup)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                title={tCommon("delete")}
                                            >
                                                {tCommon("delete")}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
            </section>

            <DeviceGroupForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingDeviceGroup}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingDeviceGroup !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingDeviceGroup?.groupName ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingDeviceGroup(null);
                }}
            />
        </div>
    );
}
