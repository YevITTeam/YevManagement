"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/Badge";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbMachineUsbDto } from "@/modules/pc-management/types/usb-log.dto";
import UsbLogList from "./UsbLogList";
import { DEVICE_CLASS_LABELS, POLICY_META, formatBytes, formatDateTime } from "./usb-log-format";

const usbName = (row: UsbMachineUsbDto) => row.friendlyName || `${row.vendorId}:${row.productId}`;

// The whole list is loaded (one PC has few USBs), so sorting stays client-side.
const SORT_KEYS: Record<string, (row: UsbMachineUsbDto) => string | number> = {
    usb: usbName,
    sessionCount: (row) => row.sessionCount,
    fileEventCount: (row) => row.fileEventCount,
    lastConnectedAt: (row) => row.lastConnectedAt,
};

// One row per USB ever plugged into the PC; expanding it lists that USB's sessions.
export default function UsbMachineUsbList({ machineName }: { machineName: string }) {
    const [rows, setRows] = useState<UsbMachineUsbDto[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [sort, setSort] = useState<SortState>(NO_SORT);

    const { isLoading, error } = useFetchEffect(
        () => UsbLogApi.getMachineUsbs(machineName),
        [machineName],
        (result) => setRows(result),
        "Không thể tải danh sách USB.",
        (message) => toast.error(message)
    );

    const sorted = useMemo(() => {
        const key = sort.sortBy ? SORT_KEYS[sort.sortBy] : undefined;
        if (!key) return rows;
        const direction = sort.sortDesc ? -1 : 1;
        return [...rows].sort((a, b) => (key(a) < key(b) ? -direction : key(a) > key(b) ? direction : 0));
    }, [rows, sort]);

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                            <th className="w-8 px-3 py-2" />
                            <SortableTh label="USB" sortKey="usb" sort={sort} onSort={setSort} className="px-3 py-2" />
                            <SortableTh label="Lần cắm" sortKey="sessionCount" sort={sort} onSort={setSort} className="px-3 py-2" />
                            <SortableTh label="File" sortKey="fileEventCount" sort={sort} onSort={setSort} className="px-3 py-2" />
                            <SortableTh label="Cắm gần nhất" sortKey="lastConnectedAt" sort={sort} onSort={setSort} className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    Đang tải dữ liệu...
                                </td>
                            </tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    Không có dữ liệu.
                                </td>
                            </tr>
                        )}
                        {sorted.map((row) => {
                            const expanded = expandedId === row.usbDeviceId;
                            // Approval is the current state; otherwise show what the agent did on the latest plug-in.
                            const policy = row.isApproved ? POLICY_META[1] : row.lastPolicyResult && row.lastPolicyResult !== 1 ? POLICY_META[row.lastPolicyResult] : undefined;
                            return (
                                <Fragment key={row.usbDeviceId}>
                                    <tr
                                        onClick={() => setExpandedId(expanded ? null : row.usbDeviceId)}
                                        className="cursor-pointer border-b border-[#f1f5f9] align-top transition hover:bg-[#f8fafc]"
                                    >
                                        <td className="px-3 py-2.5 text-[#5e3f3a]">
                                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold">{usbName(row)}</span>
                                                {policy && (
                                                    <span title={policy.title}>
                                                        <Badge variant={policy.variant}>{policy.label}</Badge>
                                                    </span>
                                                )}
                                                {row.isConnectedNow && (
                                                    <Badge variant="info" withDot>
                                                        Đang cắm
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-[#5e3f3a]">
                                                {[
                                                    row.deviceClass === "DiskDrive" ? null : DEVICE_CLASS_LABELS[row.deviceClass] ?? row.deviceClass,
                                                    row.driveLetters.join(", "),
                                                    row.serialNumber,
                                                    formatBytes(row.capacityBytes),
                                                ]
                                                    .filter((v) => v && v !== "-")
                                                    .join(" · ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.sessionCount}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.fileEventCount}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.lastConnectedAt)}</td>
                                    </tr>
                                    {expanded && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={5} className="px-3 py-3">
                                                <UsbLogList machineName={machineName} usbDeviceId={row.usbDeviceId} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
