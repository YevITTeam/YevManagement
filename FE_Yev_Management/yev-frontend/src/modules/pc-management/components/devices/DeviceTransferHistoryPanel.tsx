"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import { TransferHistoryApi } from "@/modules/pc-management/api/transfer-history.api";
import type { TransferHistoryDto } from "@/modules/pc-management/types/transfer-history.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface DeviceTransferHistoryPanelProps {
    deviceId: number;
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("vi-VN");
}

export default function DeviceTransferHistoryPanel({ deviceId }: DeviceTransferHistoryPanelProps) {
    const [history, setHistory] = useState<TransferHistoryDto[]>([]);

    const { isLoading, error } = useFetchEffect(
        () => TransferHistoryApi.getTransferHistoryByDevice(deviceId),
        [deviceId],
        (result) => setHistory(result),
        "Không thể tải lịch sử chuyển máy.",
        (message) => toast.error(message)
    );

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                <h3 className="text-base font-semibold text-[#191c1e]">Lịch sử chuyển máy</h3>
                <p className="mt-0.5 text-xs text-[#5e3f3a]">
                    Toàn bộ lượt chuyển máy liên quan đến thiết bị này, dù đóng vai trò máy cũ hay máy mới.
                </p>
            </div>

            {error && (
                <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            <th className="whitespace-nowrap px-4 py-3">Thời gian</th>
                            <th className="whitespace-nowrap px-4 py-3">Máy cũ</th>
                            <th className="whitespace-nowrap px-4 py-3">Máy mới</th>
                            <th className="px-4 py-3">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                    Đang tải...
                                </td>
                            </tr>
                        )}
                        {!isLoading && history.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                    Thiết bị chưa có lịch sử chuyển máy nào.
                                </td>
                            </tr>
                        )}
                        {history.map((item) => (
                            <tr key={item.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#5e3f3a]">{formatDateTime(item.transferDate)}</td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <div className="text-sm font-semibold text-[#191c1e]">{item.oldDeviceCode}</div>
                                    <div className="max-w-[200px] truncate text-xs text-[#5e3f3a]" title={item.oldDeviceName}>
                                        {item.oldDeviceName}
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <div className="text-sm font-semibold text-[#191c1e]">{item.newDeviceCode}</div>
                                    <div className="max-w-[200px] truncate text-xs text-[#5e3f3a]" title={item.newDeviceName}>
                                        {item.newDeviceName}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="line-clamp-2 max-w-[300px] text-xs text-[#5e3f3a]" title={item.note ?? undefined}>
                                        {item.note || "-"}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
