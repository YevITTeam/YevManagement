"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
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

interface UsbMachineUsbListProps {
    machineName: string;
    // Asset device of this PC; without it per-machine approval is not possible.
    deviceId?: number;
}

// One row per USB ever plugged into the PC; expanding it lists that USB's sessions.
export default function UsbMachineUsbList({ machineName, deviceId }: UsbMachineUsbListProps) {
    const { user } = useAuth();
    const canApprove = hasPermission(user, "Asset.UsbLog.Approve") && deviceId !== undefined;
    const columnCount = canApprove ? 6 : 5;

    const [rows, setRows] = useState<UsbMachineUsbDto[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [revoking, setRevoking] = useState<UsbMachineUsbDto | null>(null);
    const [busy, setBusy] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
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

    const setHere = async (row: UsbMachineUsbDto, approve: boolean) => {
        if (deviceId === undefined) return;
        setBusy(true);
        try {
            if (approve) await UsbLogApi.approveMachine(row.usbDeviceId, deviceId);
            else await UsbLogApi.revokeMachine(row.usbDeviceId, deviceId);
            toast.success(approve ? "Đã cấp phép USB cho máy này." : "Đã thu hồi cấp phép USB ở máy này.");
            setRevoking(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, approve ? "Cấp phép USB thất bại." : "Thu hồi cấp phép USB thất bại."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                            <th className="w-8 px-3 py-2" />
                            <SortableTh label="USB" sortKey="usb" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            <SortableTh label="Lần cắm" sortKey="sessionCount" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            <SortableTh label="File" sortKey="fileEventCount" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            <SortableTh label="Cắm gần nhất" sortKey="lastConnectedAt" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            {canApprove && <th className="px-3 py-2 text-right">Thao tác</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    Đang tải dữ liệu...
                                </td>
                            </tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    Không có dữ liệu.
                                </td>
                            </tr>
                        )}
                        {sorted.map((row) => {
                            const expanded = expandedId === row.usbDeviceId;
                            // Approval is the current state; otherwise show what the agent did on the latest plug-in.
                            const policy =
                                row.isApproved || row.approvedHere
                                    ? { ...POLICY_META[1], title: row.isApproved ? "Cấp phép cho mọi máy" : "Cấp phép riêng cho máy này" }
                                    : row.lastPolicyResult && row.lastPolicyResult !== 1
                                      ? POLICY_META[row.lastPolicyResult]
                                      : undefined;
                            const approvable = row.deviceClass === "DiskDrive" && row.serialNumber !== "" && !row.isApproved;
                            return (
                                <Fragment key={row.usbDeviceId}>
                                    <tr
                                        onClick={(event) => {
                                            // A double-click would toggle twice and a drag-select fires click too; both read as "nothing happened".
                                            const onButton = (event.target as HTMLElement).closest("button") !== null;
                                            if (!onButton && (event.detail > 1 || window.getSelection()?.toString())) return;
                                            setExpandedId(expanded ? null : row.usbDeviceId);
                                        }}
                                        className="cursor-pointer border-b border-[#f1f5f9] align-top transition hover:bg-[#f8fafc]"
                                    >
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                aria-expanded={expanded}
                                                aria-label={expanded ? "Thu gọn" : "Xem các lần cắm"}
                                                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#5e3f3a] hover:bg-[#f2f4f6]"
                                            >
                                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
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
                                        {canApprove && (
                                            <td className="whitespace-nowrap px-3 py-2 text-right text-sm" onClick={(event) => event.stopPropagation()}>
                                                {approvable &&
                                                    (row.approvedHere ? (
                                                        <button
                                                            onClick={() => setRevoking(row)}
                                                            disabled={busy}
                                                            className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Thu hồi ở máy này
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setHere(row, true)}
                                                            disabled={busy}
                                                            className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Cấp cho máy này
                                                        </button>
                                                    ))}
                                            </td>
                                        )}
                                    </tr>
                                    {expanded && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={columnCount} className="px-3 py-3">
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

            <ConfirmDialog
                isOpen={revoking !== null}
                title="Thu hồi cấp phép"
                message={`USB ${revoking ? usbName(revoking) : ""} sẽ bị chặn ghi lại trên máy ${machineName} khi đang ở chế độ Chặn.`}
                onApprove={async () => {
                    if (revoking) await setHere(revoking, false);
                }}
                onDenied={() => setRevoking(null)}
                approveLabel="Thu hồi"
                deniedLabel="Huỷ"
                loading={busy}
            />
        </section>
    );
}
