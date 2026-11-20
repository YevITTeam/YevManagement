"use client";

import { useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbDeviceDto } from "@/modules/pc-management/types/usb-log.dto";
import UsbPolicyBar from "./UsbPolicyBar";
import { DEVICE_CLASS_LABELS, formatBytes, formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const iconButtonClassName =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50";

type ApprovalFilter = "" | "approved" | "notApproved";

const emptyFilters = { keyword: "", approval: "" as ApprovalFilter, deviceClass: "" };

const APPROVAL_OPTIONS: { value: ApprovalFilter; label: string }[] = [
    { value: "", label: "Tất cả" },
    { value: "approved", label: "Đã cấp phép" },
    { value: "notApproved", label: "Chưa cấp phép" },
];

const CLASS_OPTIONS = [{ value: "", label: "Tất cả" }, ...Object.entries(DEVICE_CLASS_LABELS).map(([value, label]) => ({ value, label }))];

// Every USB device the agents have seen; approved disks stay writable when the block mode is Chặn.
export default function UsbDeviceList() {
    const { user } = useAuth();
    const canApprove = hasPermission(user, "Asset.UsbLog.Approve");

    const [rows, setRows] = useState<UsbDeviceDto[]>([]);
    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [approving, setApproving] = useState<UsbDeviceDto | null>(null);
    const [note, setNote] = useState("");
    const [revoking, setRevoking] = useState<UsbDeviceDto | null>(null);
    const [busy, setBusy] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getDevices({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                isApproved: applied.approval === "" ? undefined : applied.approval === "approved",
                deviceClass: applied.deviceClass || undefined,
            }),
        [pageIndex, applied],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        "Không thể tải danh sách thiết bị USB.",
        (message) => toast.error(message),
        "usb-devices"
    );

    const handleSearch = () => {
        setPageIndex(1);
        setApplied({ ...draft, keyword: draft.keyword.trim() });
    };

    const handleReset = () => {
        setPageIndex(1);
        setDraft(emptyFilters);
        setApplied(emptyFilters);
    };

    const openApprove = (row: UsbDeviceDto) => {
        setNote("");
        setApproving(row);
    };

    const handleApprove = async () => {
        if (!approving) return;
        setBusy(true);
        try {
            await UsbLogApi.approve(approving.id, note.trim());
            toast.success("Đã cấp phép USB.");
            setApproving(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error("Cấp phép USB thất bại.");
        } finally {
            setBusy(false);
        }
    };

    const handleRevoke = async () => {
        if (!revoking) return;
        setBusy(true);
        try {
            await UsbLogApi.revoke(revoking.id);
            toast.success("Đã thu hồi cấp phép USB.");
            setRevoking(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error("Thu hồi cấp phép USB thất bại.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <UsbPolicyBar canEdit={canApprove} />

            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-[calc(50%-0.25rem)] sm:[&>label]:w-40">
                    <label className="block max-sm:w-full! sm:w-64!">
                        <span className={fieldLabelClassName}>Tìm kiếm</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tên, serial, VID/PID, ghi chú"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Cấp phép</span>
                        <StyledSelect
                            value={draft.approval}
                            onChange={(approval) => setDraft({ ...draft, approval })}
                            options={APPROVAL_OPTIONS}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Loại</span>
                        <StyledSelect
                            value={draft.deviceClass}
                            onChange={(deviceClass) => setDraft({ ...draft, deviceClass })}
                            options={CLASS_OPTIONS}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title="Tìm kiếm"
                            aria-label="Tìm kiếm"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <button onClick={handleReset} disabled={isLoading} title="Xoá lọc" aria-label="Xoá lọc" className={iconButtonClassName}>
                            <FilterX className="h-4 w-4" />
                        </button>
                        <button onClick={() => refetch()} disabled={isLoading} title="Làm mới" aria-label="Làm mới" className={iconButtonClassName}>
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">Thiết bị</th>
                                <th className="px-3 py-2">Cấp phép</th>
                                <th className="hidden px-3 py-2 lg:table-cell">Lần cuối</th>
                                <th className="hidden px-3 py-2 text-right lg:table-cell">Lần cắm</th>
                                {canApprove && <th className="px-3 py-2 text-right">Thao tác</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={canApprove ? 5 : 4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => {
                                const isDisk = row.deviceClass === "DiskDrive";
                                return (
                                    <tr key={row.id} className="border-b border-[#f1f5f9] align-top">
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="font-semibold">{row.friendlyName || `${row.vendorId}:${row.productId}`}</div>
                                            <div className="text-xs text-[#5e3f3a]">
                                                {[
                                                    isDisk ? null : DEVICE_CLASS_LABELS[row.deviceClass] ?? row.deviceClass,
                                                    row.serialNumber || "Không có serial",
                                                    `${row.vendorId}:${row.productId}`,
                                                    row.capacityBytes ? formatBytes(row.capacityBytes) : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm">
                                            {row.isApproved ? (
                                                <div title={row.approvedBy ? `${row.approvedBy}, ${formatDateTime(row.approvedAt)}` : undefined}>
                                                    <Badge variant="success">Đã cấp phép</Badge>
                                                    {row.approvalNote && <div className="mt-1 text-xs text-[#5e3f3a]">{row.approvalNote}</div>}
                                                </div>
                                            ) : isDisk ? (
                                                <Badge variant="neutral">Chưa cấp phép</Badge>
                                            ) : (
                                                <span className="text-xs text-[#8a8f94]">Chỉ ghi log</span>
                                            )}
                                        </td>
                                        <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">
                                            <div className="whitespace-nowrap">{formatDateTime(row.lastSeenAt)}</div>
                                            {row.lastMachineName && <div className="text-xs">{row.lastMachineName}</div>}
                                        </td>
                                        <td className="hidden px-3 py-2 text-right text-sm text-[#191c1e] lg:table-cell">{row.sessionCount}</td>
                                        {canApprove && (
                                            <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                                                {row.isApproved ? (
                                                    <button
                                                        onClick={() => setRevoking(row)}
                                                        className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#7a0005]"
                                                    >
                                                        Thu hồi
                                                    </button>
                                                ) : isDisk && row.serialNumber ? (
                                                    <button
                                                        onClick={() => openApprove(row)}
                                                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    >
                                                        Cấp phép
                                                    </button>
                                                ) : null}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} thiết bị`}
                    compactSummary={isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} thiết bị`}
                />
            </section>

            <FormDialog
                isOpen={approving !== null}
                title="Cấp phép USB"
                onClose={() => setApproving(null)}
                onSubmit={handleApprove}
                loading={busy}
                submitLabel="Cấp phép"
                cancelLabel="Huỷ"
            >
                <p className="text-sm text-[#5e3f3a]">
                    {approving?.friendlyName || `${approving?.vendorId}:${approving?.productId}`} · {approving?.serialNumber}
                </p>
                <label className="block">
                    <span className={fieldLabelClassName}>Ghi chú</span>
                    <input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={255}
                        placeholder="Người giữ, mục đích"
                        className={fieldClassName}
                    />
                </label>
            </FormDialog>

            <ConfirmDialog
                isOpen={revoking !== null}
                title="Thu hồi cấp phép"
                message={`USB ${revoking?.friendlyName || revoking?.serialNumber} sẽ bị chặn ghi lại khi đang ở chế độ Chặn.`}
                onApprove={handleRevoke}
                onDenied={() => setRevoking(null)}
                approveLabel="Thu hồi"
                deniedLabel="Huỷ"
                loading={busy}
            />
        </div>
    );
}
