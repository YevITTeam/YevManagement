"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { DeviceDto } from "@/modules/pc-management/types/device.dto";

interface PrintDeviceCodeDialogProps {
    isOpen: boolean;
    devices: DeviceDto[];
    onClose: () => void;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildPrintHtml(devices: DeviceDto[]) {
    const labels = devices
        .map(
            (device) => `
      <div class="label">
        <div class="code">${escapeHtml(device.deviceCode)}</div>
        <div class="name">${escapeHtml(device.deviceName)}</div>
        <div class="branch">${escapeHtml(device.branchName)}</div>
      </div>`
        )
        .join("");

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In mã thiết bị</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Segoe UI", sans-serif; color: #191c1e; }
    .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
    .label {
      border: 1px solid #191c1e;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
      page-break-inside: avoid;
    }
    .code { font-size: 20px; font-weight: 700; letter-spacing: 1px; word-break: break-all; }
    .name { font-size: 12px; margin-top: 4px; }
    .branch { font-size: 11px; color: #555; margin-top: 2px; }
    @page { margin: 10mm; }
    @media print { .sheet { gap: 6px; } }
  </style>
</head>
<body>
  <div class="sheet">${labels}</div>
</body>
</html>`;
}

export default function PrintDeviceCodeDialog({ isOpen, devices, onClose }: PrintDeviceCodeDialogProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set());
            setSearch("");
        }
    }, [isOpen]);

    const filteredDevices = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return devices;
        return devices.filter(
            (device) =>
                device.deviceCode.toLowerCase().includes(keyword) ||
                device.deviceName.toLowerCase().includes(keyword)
        );
    }, [devices, search]);

    const allVisibleSelected = filteredDevices.length > 0 && filteredDevices.every((device) => selectedIds.has(device.id));

    if (!isOpen) return null;

    const toggleOne = (id: number) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) {
                filteredDevices.forEach((device) => next.delete(device.id));
            } else {
                filteredDevices.forEach((device) => next.add(device.id));
            }
            return next;
        });
    };

    const handlePrint = () => {
        const selected = devices.filter((device) => selectedIds.has(device.id));
        if (selected.length === 0) {
            toast.error("Vui lòng chọn ít nhất một thiết bị để in.");
            return;
        }

        const printWindow = window.open("", "_blank", "width=900,height=650");
        if (!printWindow) {
            toast.error("Không thể mở cửa sổ in. Vui lòng cho phép cửa sổ bật lên (popup).");
            return;
        }

        try {
            printWindow.document.write(buildPrintHtml(selected));
            printWindow.document.close();

            let done = false;
            const finish = (success: boolean) => {
                if (done) return;
                done = true;
                if (success) {
                    toast.success(`In thành công ${selected.length} nhãn thiết bị.`);
                } else {
                    toast.error("In không thành công. Vui lòng thử lại.");
                }
                printWindow.close();
            };

            printWindow.onafterprint = () => finish(true);

            printWindow.focus();
            printWindow.print();
        } catch (error) {
            console.error("Print failed:", error);
            toast.error("In không thành công. Vui lòng thử lại.");
            printWindow.close();
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-device-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="print-device-title" className="text-lg font-semibold text-[#191c1e]">
                            In mã thiết bị
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">Chọn các thiết bị cần in nhãn mã.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        ✕
                    </button>
                </div>

                <div className="border-b border-[#e0e3e5] p-4">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm theo mã hoặc tên thiết bị..."
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <div className="mt-3 flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                disabled={filteredDevices.length === 0}
                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                            />
                            Chọn tất cả
                        </label>
                        <span className="text-xs text-[#5e3f3a]">Đã chọn {selectedIds.size} thiết bị</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {filteredDevices.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có thiết bị phù hợp.</div>
                    ) : (
                        filteredDevices.map((device) => {
                            const checked = selectedIds.has(device.id);
                            return (
                                <label
                                    key={device.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-[#f8fafc] ${
                                        checked ? "bg-[#fff4f2]" : ""
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleOne(device.id)}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                                        <div className="truncate text-xs text-[#5e3f3a]">
                                            {device.deviceName} · {device.branchName}
                                        </div>
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-[#e0e3e5] p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={selectedIds.size === 0}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        🖨 In ({selectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
}
