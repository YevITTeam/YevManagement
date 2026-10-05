"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { DeviceSoftwareApi } from "@/modules/pc-management/api/device-software.api";
import { SoftwareApi } from "@/modules/pc-management/api/software.api";
import type { DeviceSoftwareDeviceDto } from "@/modules/pc-management/types/device-software.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeviceSoftwarePickerDialog from "./DeviceSoftwarePickerDialog";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { StyledSelect } from "@/components/ui/StyledSelect";

interface DeviceSoftwarePanelProps {
    deviceId: number;
    deviceStatus: number;
    softwares: DeviceSoftwareDeviceDto[];
    onChanged: () => void;
}

// Trạng thái Device không cho cài thêm phần mềm — khớp DeviceStatusExtensions.IsLiquidationStatus ở BE
// (2 = PendingLiquidation, 3 = Liquidated). Máy ở 2 trạng thái này bị DeviceService tự gỡ hết phần
// mềm mỗi lần Save, nên chặn thêm mới ngay từ đây để tránh cài xong lại mất.
const LIQUIDATION_STATUSES = new Set([2, 3]);

const PRIORITY_FILTER_ALL = "all";
const PRIORITY_FILTER_NONE = "none";
type PrioritySort = "none" | "asc" | "desc";

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function toDateInputValue(value: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DeviceSoftwarePanel({ deviceId, deviceStatus, softwares, onChanged }: DeviceSoftwarePanelProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const canInstall = !LIQUIDATION_STATUSES.has(deviceStatus);

    const [editingItem, setEditingItem] = useState<DeviceSoftwareDeviceDto | null>(null);
    const [editLicenseKey, setEditLicenseKey] = useState("");
    const [editInstallDate, setEditInstallDate] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [deletingItem, setDeletingItem] = useState<DeviceSoftwareDeviceDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // DeviceSoftware/device/{deviceId} không trả softwarePriority — join thêm từ danh mục phần mềm để lọc/sắp xếp theo ưu tiên.
    const [priorityMap, setPriorityMap] = useState<Map<number, number | null>>(new Map());
    const [priorityFilter, setPriorityFilter] = useState<string>(PRIORITY_FILTER_ALL);
    const [prioritySort, setPrioritySort] = useState<PrioritySort>("none");

    useEffect(() => {
        let isCancelled = false;
        SoftwareApi.getAllSoftware()
            .then((result) => {
                if (isCancelled) return;
                setPriorityMap(new Map(result.map((software) => [software.id, software.softwarePriority])));
            })
            .catch((err) => {
                if (!isCancelled) toast.error(getApiErrorMessage(err, "Không thể tải mức ưu tiên phần mềm."));
            });
        return () => {
            isCancelled = true;
        };
    }, []);

    const enrichedSoftwares = useMemo(
        () =>
            softwares.map((item) => ({
                ...item,
                softwarePriority: priorityMap.get(item.softwareId) ?? null,
            })),
        [softwares, priorityMap]
    );

    const priorityOptions = useMemo(() => {
        const values = new Set<number>();
        let hasNone = false;
        enrichedSoftwares.forEach((item) => {
            if (item.softwarePriority === null) hasNone = true;
            else values.add(item.softwarePriority);
        });
        return { values: Array.from(values).sort((a, b) => a - b), hasNone };
    }, [enrichedSoftwares]);

    const visibleSoftwares = useMemo(() => {
        let list = enrichedSoftwares.filter((item) => {
            if (priorityFilter === PRIORITY_FILTER_ALL) return true;
            if (priorityFilter === PRIORITY_FILTER_NONE) return item.softwarePriority === null;
            return item.softwarePriority === Number(priorityFilter);
        });

        if (prioritySort !== "none") {
            list = [...list].sort((a, b) => {
                const aValue = a.softwarePriority ?? Number.POSITIVE_INFINITY;
                const bValue = b.softwarePriority ?? Number.POSITIVE_INFINITY;
                return prioritySort === "asc" ? aValue - bValue : bValue - aValue;
            });
        }
        return list;
    }, [enrichedSoftwares, priorityFilter, prioritySort]);

    const togglePrioritySort = () => {
        setPrioritySort((current) => (current === "none" ? "asc" : current === "asc" ? "desc" : "none"));
    };

    useDialogReset(editingItem !== null, editingItem, (current) => {
        if (!current) return;
        setEditLicenseKey(current.licenseKey ?? "");
        setEditInstallDate(toDateInputValue(current.installDate));
    });

    const openEdit = (item: DeviceSoftwareDeviceDto) => setEditingItem(item);
    const closeEdit = () => {
        if (isSavingEdit) return;
        setEditingItem(null);
    };

    const handleSaveEdit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingItem) return;
        setIsSavingEdit(true);
        try {
            await DeviceSoftwareApi.updateDeviceSoftware({
                deviceId,
                softwareId: editingItem.softwareId,
                licenseKey: editLicenseKey.trim() ? editLicenseKey.trim() : null,
                installDate: editInstallDate || null,
            });
            toast.success("Cập nhật phần mềm thành công");
            setEditingItem(null);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phần mềm thất bại"));
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            await DeviceSoftwareApi.deleteDeviceSoftware(deviceId, deletingItem.softwareId);
            toast.success("Gỡ phần mềm thành công");
            setDeletingItem(null);
            onChanged();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Gỡ phần mềm thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-[#191c1e]">Phần mềm đã cài</h3>
                        <p className="mt-0.5 text-xs text-[#5e3f3a]">
                            {visibleSoftwares.length} / {softwares.length} phần mềm đang cài trên thiết bị.
                        </p>
                        {!canInstall && (
                            <p className="mt-0.5 text-xs font-semibold text-[#930006]">
                                Thiết bị đang chờ thanh lý/đã thanh lý — không thể cài thêm phần mềm.
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <StyledSelect
                            value={priorityFilter}
                            onChange={setPriorityFilter}
                            triggerClassName="h-9 w-44 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-xs text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            options={[
                                { value: PRIORITY_FILTER_ALL, label: "Tất cả mức ưu tiên" },
                                ...priorityOptions.values.map((value) => ({ value: String(value), label: `Ưu tiên ${value}` })),
                                ...(priorityOptions.hasNone ? [{ value: PRIORITY_FILTER_NONE, label: "Chưa đặt ưu tiên" }] : []),
                            ]}
                        />
                        <button
                            onClick={() => setPickerOpen(true)}
                            disabled={!canInstall}
                            title={canInstall ? undefined : "Thiết bị đang chờ thanh lý/đã thanh lý, không thể cài thêm phần mềm."}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cập nhật phần mềm
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-4 py-3">Tên phần mềm</th>
                                <th className="whitespace-nowrap px-4 py-3">Ngày cài</th>
                                <th className="whitespace-nowrap px-4 py-3">License key</th>
                                <th className="whitespace-nowrap px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        onClick={togglePrioritySort}
                                        className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a] transition hover:text-[#191c1e]"
                                        title="Sắp xếp theo ưu tiên"
                                    >
                                        Ưu tiên
                                        {prioritySort === "asc" && <ArrowUp size={14} />}
                                        {prioritySort === "desc" && <ArrowDown size={14} />}
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleSoftwares.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                        {softwares.length === 0 ? "Chưa cài phần mềm nào." : "Không có phần mềm phù hợp."}
                                    </td>
                                </tr>
                            )}
                            {visibleSoftwares.map((item) => (
                                <tr key={item.softwareId} className="border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-[#191c1e]">{item.softwareName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{formatDate(item.installDate)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{item.licenseKey || "-"}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-[#5e3f3a]">{item.softwarePriority ?? "—"}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                title="Sửa"
                                                aria-label="Sửa"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingItem(item)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e9bcb6] text-[#930006] hover:bg-[#fff4f2]"
                                                title="Gỡ"
                                                aria-label="Gỡ"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/40" onClick={closeEdit} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-sm rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <h3 className="mb-4 text-lg font-semibold text-[#191c1e]">Sửa: {editingItem.softwareName}</h3>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <label className="block">
                                <span className={fieldLabelClassName}>License key</span>
                                <input
                                    value={editLicenseKey}
                                    onChange={(event) => setEditLicenseKey(event.target.value)}
                                    disabled={isSavingEdit}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Ngày cài</span>
                                <input
                                    type="date"
                                    value={editInstallDate}
                                    onChange={(event) => setEditInstallDate(event.target.value)}
                                    disabled={isSavingEdit}
                                    className={fieldClassName}
                                />
                            </label>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    disabled={isSavingEdit}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSavingEdit ? "Đang lưu..." : "Lưu"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deletingItem !== null}
                title="Gỡ phần mềm"
                message={
                    <>
                        Bạn có chắc muốn gỡ <strong>{deletingItem?.softwareName}</strong> khỏi thiết bị này không?
                    </>
                }
                approveLabel="Gỡ"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingItem(null);
                }}
            />

            <DeviceSoftwarePickerDialog
                isOpen={pickerOpen}
                deviceId={deviceId}
                onClose={() => setPickerOpen(false)}
                onSynced={() => {
                    setPickerOpen(false);
                    onChanged();
                }}
            />
        </div>
    );
}
