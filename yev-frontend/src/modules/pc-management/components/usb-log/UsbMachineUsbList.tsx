"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { UsbFileCount } from "./UsbSessionFiles";
import { POLICY_META, USB_ACCESS_LEVEL, deviceClassLabel, formatBytes, formatDateTime, usbLabel } from "./usb-log-format";

const usbName = (row: UsbMachineUsbDto) => usbLabel(row);

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
    const t = useTranslations("usbLog");
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
        t("machineUsbs.loadError"),
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
            toast.success(approve ? t("machineUsbs.approveHereSuccess") : t("machineUsbs.revokeHereSuccess"));
            setRevoking(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, approve ? t("common.approveFailed") : t("common.revokeFailed")));
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
                            <SortableTh label={t("common.sessionCount")} sortKey="sessionCount" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            <SortableTh label={t("common.file")} sortKey="fileEventCount" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            <SortableTh label={t("machineUsbs.lastConnected")} sortKey="lastConnectedAt" sort={sort} onSort={setSort} className="whitespace-nowrap px-3 py-2" />
                            {canApprove && <th className="px-3 py-2 text-right">{t("common.actions")}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    {t("common.loadingData")}
                                </td>
                            </tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr>
                                <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                    {t("common.noData")}
                                </td>
                            </tr>
                        )}
                        {sorted.map((row) => {
                            const expanded = expandedId === row.usbDeviceId;
                            // Approval is the current state; otherwise show what the agent did on the latest plug-in.
                            const approved = row.isApproved || row.approvedHere;
                            const meta = approved
                                ? POLICY_META[row.accessLevel === USB_ACCESS_LEVEL.ReadOnly ? 5 : 1]
                                : row.lastPolicyResult && row.lastPolicyResult !== 1
                                  ? POLICY_META[row.lastPolicyResult]
                                  : undefined;
                            const policy = meta && {
                                variant: meta.variant,
                                label: t(`policy.${meta.key}.label`),
                                title: approved
                                    ? t(row.isApproved ? "machineUsbs.approvedAll" : "machineUsbs.approvedHere")
                                    : t(`policy.${meta.key}.title`),
                            };
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
                                                aria-label={expanded ? t("common.collapse") : t("machineUsbs.viewSessions")}
                                                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#5e3f3a] hover:bg-[#f2f4f6]"
                                            >
                                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold">{usbName(row)}</span>
                                                {row.isSharedSerial && (
                                                    <span title={t("machineUsbs.sharedSerialTitle")}>
                                                        <Badge variant="warning">{t("common.sharedSerial")}</Badge>
                                                    </span>
                                                )}
                                                {policy && (
                                                    <span title={policy.title}>
                                                        <Badge variant={policy.variant}>{policy.label}</Badge>
                                                    </span>
                                                )}
                                                {row.isConnectedNow && (
                                                    <Badge variant="info" withDot>
                                                        {t("common.connectedNow")}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="break-all text-xs text-[#5e3f3a]">
                                                {[
                                                    row.alias ? row.friendlyName : null,
                                                    row.deviceClass === "DiskDrive" ? null : deviceClassLabel(t, row.deviceClass),
                                                    row.driveLetters.join(", "),
                                                    row.serialNumber,
                                                    formatBytes(row.capacityBytes),
                                                ]
                                                    .filter((v) => v && v !== "-")
                                                    .join(" · ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.sessionCount}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                            <UsbFileCount total={row.fileEventCount} sensitive={row.sensitiveFileCount} />
                                        </td>
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
                                                            {t("machineUsbs.revokeHere")}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setHere(row, true)}
                                                            disabled={busy}
                                                            className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {t("machineUsbs.approveHere")}
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
                title={t("common.revokeTitle")}
                message={t("machineUsbs.revokeMessage", { usb: revoking ? usbName(revoking) : "", machine: machineName })}
                onApprove={async () => {
                    if (revoking) await setHere(revoking, false);
                }}
                onDenied={() => setRevoking(null)}
                approveLabel={t("common.revoke")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />
        </section>
    );
}
