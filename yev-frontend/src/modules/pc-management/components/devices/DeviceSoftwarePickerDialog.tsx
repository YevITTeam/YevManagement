"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "react-toastify";

import { DeviceSoftwareApi } from "@/modules/pc-management/api/device-software.api";
import { SoftwareApi } from "@/modules/pc-management/api/software.api";
import type { DeviceSoftwarePickerDto, DeviceSoftwareSyncItemDto } from "@/modules/pc-management/types/device-software.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface DeviceSoftwarePickerDialogProps {
    isOpen: boolean;
    deviceId: number;
    onClose: () => void;
    onSynced: () => void;
}

interface NewItemDetails {
    licenseKey: string;
    installDate: string;
}

// Picker (GET /DeviceSoftware/picker/{deviceId}) không trả về softwarePriority — phải lấy riêng từ
// GET /Software/all rồi merge theo softwareId để có dữ liệu sắp xếp theo mức độ ưu tiên.
interface PickerItemWithPriority extends DeviceSoftwarePickerDto {
    softwarePriority: number | null;
}

type PrioritySort = "none" | "asc" | "desc";

export default function DeviceSoftwarePickerDialog({ isOpen, deviceId, onClose, onSynced }: DeviceSoftwarePickerDialogProps) {
    const [items, setItems] = useState<PickerItemWithPriority[]>([]);
    const [search, setSearch] = useState("");
    const [prioritySort, setPrioritySort] = useState<PrioritySort>("none");

    const [originalSelectedIds, setOriginalSelectedIds] = useState<Set<number>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [newItemDetails, setNewItemDetails] = useState<Record<number, NewItemDetails>>({});
    const [isSaving, setIsSaving] = useState(false);

    useDialogReset(isOpen, deviceId, () => {
        setSearch("");
        setPrioritySort("none");
    });

    const { isLoading } = useFetchEffect(
        () =>
            !isOpen
                ? Promise.resolve(null)
                : Promise.all([DeviceSoftwareApi.getDeviceSoftwarePicker(deviceId), SoftwareApi.getAllSoftware()]),
        [isOpen, deviceId],
        (result) => {
            if (!result) return;
            const [pickerResult, allSoftware] = result;
            const priorityBySoftwareId = new Map(allSoftware.map((software) => [software.id, software.softwarePriority]));
            const enriched: PickerItemWithPriority[] = pickerResult.map((item) => ({
                ...item,
                softwarePriority: priorityBySoftwareId.get(item.softwareId) ?? null,
            }));
            setItems(enriched);
            const selected = new Set(enriched.filter((item) => item.isSelected).map((item) => item.softwareId));
            setOriginalSelectedIds(selected);
            setSelectedIds(new Set(selected));
            setNewItemDetails({});
        },
        "Không thể tải danh sách phần mềm.",
        (message) => toast.error(message)
    );

    const togglePrioritySort = () => {
        setPrioritySort((current) => (current === "none" ? "asc" : current === "asc" ? "desc" : "none"));
    };

    const filteredItems = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        const result = keyword
            ? items.filter(
                  (item) => item.softwareName.toLowerCase().includes(keyword) || item.softwareCode.toLowerCase().includes(keyword)
              )
            : items;

        if (prioritySort === "none") return result;

        return [...result].sort((a, b) => {
            const aValue = a.softwarePriority ?? Number.POSITIVE_INFINITY;
            const bValue = b.softwarePriority ?? Number.POSITIVE_INFINITY;
            return prioritySort === "asc" ? aValue - bValue : bValue - aValue;
        });
    }, [items, search, prioritySort]);

    if (!isOpen) return null;

    const toggleItem = (item: DeviceSoftwarePickerDto) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(item.softwareId)) {
                next.delete(item.softwareId);
            } else {
                next.add(item.softwareId);
            }
            return next;
        });
    };

    const updateNewItemDetail = (softwareId: number, field: keyof NewItemDetails, value: string) => {
        setNewItemDetails((current) => ({
            ...current,
            [softwareId]: { ...(current[softwareId] ?? { licenseKey: "", installDate: "" }), [field]: value },
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const syncItems: DeviceSoftwareSyncItemDto[] = Array.from(selectedIds).map((softwareId) => {
                if (originalSelectedIds.has(softwareId)) {
                    return { softwareId };
                }
                const details = newItemDetails[softwareId];
                return {
                    softwareId,
                    licenseKey: details?.licenseKey.trim() ? details.licenseKey.trim() : null,
                    installDate: details?.installDate ? details.installDate : null,
                };
            });

            await DeviceSoftwareApi.syncDeviceSoftware({ deviceId, items: syncItems });
            toast.success("Cập nhật phần mềm thiết bị thành công");
            onSynced();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phần mềm thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="software-picker-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="software-picker-title" className="text-lg font-semibold text-[#191c1e]">
                            Cập nhật phần mềm
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">Tick chọn phần mềm cần cài trên thiết bị.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="border-b border-[#e0e3e5] p-4">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm theo mã hoặc tên phần mềm..."
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-[#5e3f3a]">Đã chọn {selectedIds.size} phần mềm</span>
                        <button
                            type="button"
                            onClick={togglePrioritySort}
                            className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a] transition hover:text-[#191c1e]"
                            title="Sắp xếp theo mức độ ưu tiên"
                        >
                            Ưu tiên
                            {prioritySort === "asc" && <ArrowUp size={14} />}
                            {prioritySort === "desc" && <ArrowDown size={14} />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có phần mềm phù hợp.</div>
                    ) : (
                        filteredItems.map((item) => {
                            const checked = selectedIds.has(item.softwareId);
                            const isNewlyTicked = checked && !originalSelectedIds.has(item.softwareId);
                            return (
                                <div key={item.softwareId} className={`rounded-lg px-3 py-2.5 transition ${checked ? "bg-[#fff4f2]" : ""}`}>
                                    <label className="flex cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleItem(item)}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-[#191c1e]">{item.softwareName}</div>
                                            <div className="truncate text-xs text-[#5e3f3a]">{item.softwareCode}</div>
                                        </div>
                                        <span className="shrink-0 text-xs text-[#5e3f3a]">
                                            Ưu tiên: {item.softwarePriority ?? "—"}
                                        </span>
                                    </label>
                                    {isNewlyTicked && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 pl-7">
                                            <input
                                                value={newItemDetails[item.softwareId]?.licenseKey ?? ""}
                                                onChange={(event) => updateNewItemDetail(item.softwareId, "licenseKey", event.target.value)}
                                                placeholder="License key (tuỳ chọn)"
                                                className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-2 text-xs text-[#191c1e] outline-none focus:border-[#e3000f]"
                                            />
                                            <input
                                                type="date"
                                                value={newItemDetails[item.softwareId]?.installDate ?? ""}
                                                onChange={(event) => updateNewItemDetail(item.softwareId, "installDate", event.target.value)}
                                                className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-2 text-xs text-[#191c1e] outline-none focus:border-[#e3000f]"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-[#e0e3e5] p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? "Đang lưu..." : "Lưu"}
                    </button>
                </div>
            </div>
        </div>
    );
}
