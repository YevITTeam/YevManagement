"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { DeviceApi } from "@/modules/pc-management/api/device.api";
import { TransferHistoryApi } from "@/modules/pc-management/api/transfer-history.api";
import type { DeviceDto, DeviceReplacementSuggestionDto } from "@/modules/pc-management/types/device.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface TransferableDevice {
    id: number;
    deviceCode: string;
    deviceName: string;
}

interface TransferDeviceDialogProps {
    isOpen: boolean;
    oldDevice: TransferableDevice | null;
    // docs/asset-api-fe.md §5.10 — gợi ý "MQL Cũ" từ import Excel (pendingTransfers):
    // điền sẵn máy mới nhưng vẫn cho người dùng sửa lại trước khi bấm "Chuyển".
    initialNewDeviceId?: number | null;
    onClose: () => void;
    onTransferred: () => void;
}

export default function TransferDeviceDialog({ isOpen, oldDevice, initialNewDeviceId, onClose, onTransferred }: TransferDeviceDialogProps) {
    const [search, setSearch] = useState("");
    const [candidates, setCandidates] = useState<DeviceDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const [note, setNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    // Gợi ý máy mới suy ra từ cột "MQL Cũ" lúc import Excel (docs/asset-api-fe.md §5.9) — chỉ tự tra khi
    // dialog KHÔNG được mở sẵn với 1 gợi ý cụ thể từ màn "Import Excel" (initialNewDeviceId).
    const [suggestion, setSuggestion] = useState<DeviceReplacementSuggestionDto | null>(null);

    // Reset field khi mở lại dialog (đổi máy cũ/gợi ý) — so sánh snapshot ngay trong render thay effect.
    const resetKey = `${isOpen}|${oldDevice?.id ?? ""}|${initialNewDeviceId ?? ""}`;
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    if (prevResetKey !== resetKey) {
        setPrevResetKey(resetKey);
        if (isOpen && oldDevice) {
            setSearch("");
            setNote("");
            setSuggestion(null);
            setSelectedDeviceId(initialNewDeviceId ?? null);
        }
    }

    // Tự tra gợi ý máy mới (docs/asset-api-fe.md §5.9) — chỉ khi KHÔNG có initialNewDeviceId đã điền sẵn.
    useEffect(() => {
        if (!isOpen || !oldDevice || initialNewDeviceId != null) return;
        let isCancelled = false;
        DeviceApi.getReplacementSuggestion(oldDevice.id)
            .then((result) => {
                if (isCancelled || !result) return;
                setSuggestion(result);
                setSelectedDeviceId(result.id);
            })
            .catch(() => {
                // Không có gợi ý hoặc lỗi tra cứu — bỏ qua, người dùng vẫn chọn máy mới thủ công như bình thường.
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, oldDevice, initialNewDeviceId]);

    useEffect(() => {
        if (!isOpen || !oldDevice) return;
        let isCancelled = false;
        const timeoutId = setTimeout(() => {
            setIsLoading(true);
            DeviceApi.getAvailableDevices(search || undefined)
                .then((result) => {
                    if (isCancelled) return;
                    setCandidates(result.filter((device) => device.id !== oldDevice.id));
                })
                .catch((err) => {
                    if (!isCancelled) toast.error(getApiErrorMessage(err, "Không thể tải danh sách thiết bị."));
                })
                .finally(() => {
                    if (!isCancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            isCancelled = true;
            clearTimeout(timeoutId);
        };
    }, [isOpen, oldDevice, search]);

    if (!isOpen || !oldDevice) return null;

    const handleSubmit = async () => {
        if (!selectedDeviceId) {
            toast.error("Vui lòng chọn máy mới để chuyển đến.");
            return;
        }
        setIsSaving(true);
        try {
            await TransferHistoryApi.createTransfer({
                oldDeviceId: oldDevice.id,
                newDeviceId: selectedDeviceId,
                note: note.trim() ? note.trim() : null,
            });
            toast.success("Chuyển máy thành công");
            onTransferred();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Chuyển máy thất bại"));
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
                aria-labelledby="transfer-device-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="transfer-device-title" className="text-lg font-semibold text-[#191c1e]">
                            Chuyển máy
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chuyển IP và phần mềm từ <strong>{oldDevice.deviceCode}</strong> sang máy mới đã có sẵn trong hệ thống.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        ✕
                    </button>
                </div>

                <div className="border-b border-[#e0e3e5] p-4">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        Máy cũ
                    </span>
                    <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-sm">
                        <div className="font-semibold text-[#191c1e]">{oldDevice.deviceCode}</div>
                        <div className="text-xs text-[#5e3f3a]">{oldDevice.deviceName}</div>
                    </div>
                </div>

                {suggestion && selectedDeviceId === suggestion.id && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-2.5 text-xs text-[#930006]">
                        Đã tự điền gợi ý từ lúc import Excel (cột &quot;MQL Cũ&quot;): <strong>{suggestion.deviceCode}</strong> — vẫn có thể đổi sang máy khác bên dưới.
                    </div>
                )}

                <div className="border-b border-[#e0e3e5] p-4">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        Máy mới
                    </span>
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm theo mã thiết bị..."
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                    ) : candidates.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có thiết bị phù hợp.</div>
                    ) : (
                        candidates.map((device) => {
                            const checked = selectedDeviceId === device.id;
                            return (
                                <label
                                    key={device.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-[#f8fafc] ${
                                        checked ? "bg-[#fff4f2]" : ""
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="new-device"
                                        checked={checked}
                                        onChange={() => setSelectedDeviceId(device.id)}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                                        <div className="truncate text-xs text-[#5e3f3a]">{device.deviceName}</div>
                                    </div>
                                    <span className="shrink-0 text-xs text-[#5e3f3a]">{device.statusText}</span>
                                </label>
                            );
                        })
                    )}
                </div>

                <div className="border-t border-[#e0e3e5] p-4">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        Ghi chú
                    </span>
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        placeholder="Lý do chuyển máy (tuỳ chọn)..."
                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
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
                        onClick={handleSubmit}
                        disabled={isSaving || !selectedDeviceId}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? "Đang chuyển..." : "Chuyển máy"}
                    </button>
                </div>
            </div>
        </div>
    );
}
