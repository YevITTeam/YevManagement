"use client";

import { useState } from "react";
import { FilterX, Pencil, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { Badge } from "@/components/ui/Badge";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbDeviceDto } from "@/modules/pc-management/types/usb-log.dto";
import UsbExportButton from "./UsbExportButton";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";
import UsbPolicyBar from "./UsbPolicyBar";
import { ACCESS_LEVEL_OPTIONS, DEVICE_CLASSES, USB_ACCESS_LEVEL, deviceClassLabel, formatBytes, formatDateTime, usbLabel } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const iconButtonClassName =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50";

type ApprovalFilter = "" | "approved" | "notApproved";

const emptyFilters = { keyword: "", approval: "" as ApprovalFilter, deviceClass: "", branchId: 0, departmentId: 0 };

const APPROVAL_OPTIONS: { value: ApprovalFilter; key: string }[] = [
    { value: "", key: "common.all" },
    { value: "approved", key: "devices.approved" },
    { value: "notApproved", key: "common.notApproved" },
];

type ApprovalScope = "all" | "machines";

const SCOPE_OPTIONS: { value: ApprovalScope; key: string }[] = [
    { value: "all", key: "devices.allMachines" },
    { value: "machines", key: "devices.pickMachines" },
];

// Every USB device the agents have seen; approved disks stay writable when the block mode is Chặn.
export default function UsbDeviceList() {
    const t = useTranslations("usbLog");
    const { user } = useAuth();
    const canApprove = hasPermission(user, "Asset.UsbLog.Approve");

    const [rows, setRows] = useState<UsbDeviceDto[]>([]);
    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [approving, setApproving] = useState<UsbDeviceDto | null>(null);
    const [note, setNote] = useState("");
    const [scope, setScope] = useState<ApprovalScope>("all");
    const [machineIds, setMachineIds] = useState<number[]>([]);
    const [accessLevel, setAccessLevel] = useState<number>(USB_ACCESS_LEVEL.ReadWrite);
    const [machineOptions, setMachineOptions] = useState<MultiSelectOption[] | null>(null);
    const [revoking, setRevoking] = useState<UsbDeviceDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [naming, setNaming] = useState<UsbDeviceDto | null>(null);
    const [alias, setAlias] = useState("");
    const [branchId, setBranchId] = useState(0);
    const [departmentId, setDepartmentId] = useState(0);
    const owners = useUsbOwnerOptions();
    const approvalOptions = APPROVAL_OPTIONS.map(({ value, key }) => ({ value, label: t(key) }));
    const scopeOptions = SCOPE_OPTIONS.map(({ value, key }) => ({ value, label: t(key) }));
    const classOptions = [{ value: "", label: t("common.all") }, ...DEVICE_CLASSES.map((value) => ({ value, label: deviceClassLabel(t, value) }))];
    const accessLevelOptions = ACCESS_LEVEL_OPTIONS.map(({ value, key }) => ({ value, label: t(`accessLevel.${key}`) }));

    const openAlias = (row: UsbDeviceDto) => {
        setAlias(row.alias ?? "");
        setNaming(row);
    };

    const handleAlias = async () => {
        if (!naming) return;
        setBusy(true);
        try {
            await UsbLogApi.setAlias(naming.id, alias.trim());
            toast.success(t("devices.aliasSaved"));
            setNaming(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("devices.aliasFailed")));
        } finally {
            setBusy(false);
        }
    };

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getDevices({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                isApproved: applied.approval === "" ? undefined : applied.approval === "approved",
                deviceClass: applied.deviceClass || undefined,
                branchId: applied.branchId || undefined,
                departmentId: applied.departmentId || undefined,
                ...sort,
            }),
        [pageIndex, applied, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("devices.loadError"),
        (message) => toast.error(message),
        "usb-devices"
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

    const handleSearch = () => {
        setPageIndex(1);
        setApplied({ ...draft, keyword: draft.keyword.trim() });
    };

    const handleReset = () => {
        setPageIndex(1);
        setDraft(emptyFilters);
        setApplied(emptyFilters);
    };

    const exportFilter = () => ({
        keyword: applied.keyword || undefined,
        isApproved: applied.approval === "" ? undefined : applied.approval === "approved",
        deviceClass: applied.deviceClass || undefined,
        branchId: applied.branchId || undefined,
        departmentId: applied.departmentId || undefined,
    });

    const openApprove = (row: UsbDeviceDto) => {
        setNote(row.approvalNote ?? "");
        setScope(row.approvedMachines.length > 0 ? "machines" : "all");
        setMachineIds(row.approvedMachines.map((m) => m.deviceId));
        setAccessLevel(row.accessLevel || USB_ACCESS_LEVEL.ReadWrite);
        setBranchId(row.branchId ?? 0);
        setDepartmentId(row.departmentId ?? 0);
        setApproving(row);
        if (machineOptions === null) {
            UsbLogApi.getMachineOptions()
                .then((options) =>
                    setMachineOptions(
                        options.map((o) => ({ value: o.id, label: `${o.deviceCode} · ${o.deviceName}`, searchText: `${o.deviceCode} ${o.deviceName}`.toLowerCase() }))
                    )
                )
                .catch((err) => toast.error(getApiErrorMessage(err, t("devices.machinesLoadError"))));
        }
    };

    const handleApprove = async () => {
        if (!approving) return;
        if (scope === "machines" && machineIds.length === 0) {
            toast.error(t("devices.pickAtLeastOne"));
            return;
        }
        if (!branchId || !departmentId) {
            toast.error(t("devices.pickOwner"));
            return;
        }
        setBusy(true);
        try {
            await UsbLogApi.approve(approving.id, {
                note: note.trim() || null,
                allMachines: scope === "all",
                deviceIds: scope === "all" ? [] : machineIds,
                accessLevel,
                branchId,
                departmentId,
            });
            toast.success(t("devices.approveSuccess"));
            setApproving(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("common.approveFailed")));
        } finally {
            setBusy(false);
        }
    };

    const handleRevoke = async () => {
        if (!revoking) return;
        setBusy(true);
        try {
            await UsbLogApi.revoke(revoking.id);
            toast.success(t("devices.revokeSuccess"));
            setRevoking(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(t("common.revokeFailed"));
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
                        <span className={fieldLabelClassName}>{t("common.search")}</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("devices.searchPlaceholder")}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("common.approve")}</span>
                        <StyledSelect
                            value={draft.approval}
                            onChange={(approval) => setDraft({ ...draft, approval })}
                            options={approvalOptions}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("devices.class")}</span>
                        <StyledSelect
                            value={draft.deviceClass}
                            onChange={(deviceClass) => setDraft({ ...draft, deviceClass })}
                            options={classOptions}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                    <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title={t("common.search")}
                            aria-label={t("common.search")}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <button onClick={handleReset} disabled={isLoading} title={t("common.clearFilter")} aria-label={t("common.clearFilter")} className={iconButtonClassName}>
                            <FilterX className="h-4 w-4" />
                        </button>
                        <button onClick={() => refetch()} disabled={isLoading} title={t("common.refresh")} aria-label={t("common.refresh")} className={iconButtonClassName}>
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="sm:ml-auto">
                        <UsbExportButton
                            label="Excel"
                            title={t("devices.exportTitle")}
                            fallbackFileName="ThietBiUSB.xlsx"
                            download={() => UsbLogApi.exportDevices(exportFilter())}
                        />
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <SortableTh label={t("devices.device")} sortKey="name" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{t("common.owner")}</th>
                                <SortableTh label={t("common.approve")} sortKey="isApproved" sort={sort} onSort={handleSort} className="whitespace-nowrap px-3 py-2" />
                                <SortableTh label={t("common.lastSeen")} sortKey="lastSeenAt" sort={sort} onSort={handleSort} className="hidden whitespace-nowrap px-3 py-2 lg:table-cell" />
                                <SortableTh label={t("common.sessionCount")} sortKey="sessionCount" sort={sort} onSort={handleSort} className="hidden whitespace-nowrap px-3 py-2 text-right lg:table-cell" />
                                {canApprove && <th className="whitespace-nowrap px-3 py-2 text-right">{t("common.actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={canApprove ? 6 : 5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("common.noData")}
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => {
                                const isDisk = row.deviceClass === "DiskDrive";
                                const isApproved = row.isApproved || row.approvedMachines.length > 0;
                                return (
                                    <tr key={row.id} className="border-b border-[#f1f5f9] align-top">
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold">{usbLabel(row)}</span>
                                                {row.isSharedSerial && (
                                                    <span title={t("devices.sharedSerialTitle")}>
                                                        <Badge variant="warning">{t("common.sharedSerial")}</Badge>
                                                    </span>
                                                )}
                                                {canApprove && (
                                                    <button
                                                        onClick={() => openAlias(row)}
                                                        title={t("devices.setAlias")}
                                                        aria-label={t("devices.setAlias")}
                                                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-[#8a8f94] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="break-all text-xs text-[#5e3f3a]">
                                                {[
                                                    row.alias ? row.friendlyName : null,
                                                    isDisk ? null : deviceClassLabel(t, row.deviceClass),
                                                    row.serialNumber || t("common.noSerial"),
                                                    `${row.vendorId}:${row.productId}`,
                                                    row.capacityBytes ? formatBytes(row.capacityBytes) : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </td>
                                        <td className="hidden px-3 py-2 text-sm text-[#191c1e] md:table-cell">
                                            <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                        </td>
                                        <td className="px-3 py-2 text-sm">
                                            {isApproved ? (
                                                <div title={row.approvedBy ? `${row.approvedBy}, ${formatDateTime(row.approvedAt)}` : undefined}>
                                                    <div className="flex flex-wrap gap-1">
                                                        <Badge variant="success">{row.isApproved ? t("devices.allMachines") : t("devices.machineCount", { count: row.approvedMachines.length })}</Badge>
                                                        {row.accessLevel === USB_ACCESS_LEVEL.ReadOnly && <Badge variant="warning">{t("accessLevel.readOnly")}</Badge>}
                                                    </div>
                                                    {row.approvedMachines.length > 0 && (
                                                        <div
                                                            className="mt-1 text-xs text-[#191c1e]"
                                                            title={row.approvedMachines.map((m) => m.deviceCode).join(", ")}
                                                        >
                                                            {row.approvedMachines
                                                                .slice(0, 3)
                                                                .map((m) => m.deviceCode)
                                                                .join(", ")}
                                                            {row.approvedMachines.length > 3 && ` +${row.approvedMachines.length - 3}`}
                                                        </div>
                                                    )}
                                                    {row.approvalNote && <div className="mt-1 text-xs text-[#5e3f3a]">{row.approvalNote}</div>}
                                                </div>
                                            ) : isDisk ? (
                                                <Badge variant="neutral">{t("common.notApproved")}</Badge>
                                            ) : (
                                                <span className="text-xs text-[#8a8f94]">{t("devices.logOnly")}</span>
                                            )}
                                        </td>
                                        <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">
                                            <div className="whitespace-nowrap">{formatDateTime(row.lastSeenAt)}</div>
                                            {row.lastMachineName && <div className="text-xs">{row.lastMachineName}</div>}
                                        </td>
                                        <td className="hidden px-3 py-2 text-right text-sm text-[#191c1e] lg:table-cell">{row.sessionCount}</td>
                                        {canApprove && (
                                            <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                                                {isApproved ? (
                                                    <div className="flex justify-end gap-3">
                                                        <button
                                                            onClick={() => openApprove(row)}
                                                            className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                        >
                                                            {t("devices.edit")}
                                                        </button>
                                                        <button
                                                            onClick={() => setRevoking(row)}
                                                            className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#7a0005]"
                                                        >
                                                            {t("common.revoke")}
                                                        </button>
                                                    </div>
                                                ) : isDisk && row.serialNumber ? (
                                                    <button
                                                        onClick={() => openApprove(row)}
                                                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    >
                                                        {t("common.approve")}
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
                    summary={isLoading ? t("common.loadingData") : t("common.shownDevices", { shown: rows.length, total: totalCount })}
                    compactSummary={isLoading ? t("common.loadingData") : t("common.shownDevices", { shown: rows.length, total: totalCount })}
                />
            </section>

            <FormDialog
                isOpen={approving !== null}
                title={t("devices.approveTitle")}
                onClose={() => setApproving(null)}
                onSubmit={handleApprove}
                loading={busy}
                submitLabel={t("common.approve")}
                cancelLabel={t("common.cancel")}
            >
                <p className="break-all text-sm text-[#5e3f3a]">
                    {approving && usbLabel(approving)} · {approving?.serialNumber}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("common.branch")}</span>
                        <StyledSelect
                            value={branchId}
                            onChange={setBranchId}
                            options={[{ value: 0, label: t("devices.pickBranch") }, ...owners.branches]}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("common.department")}</span>
                        <StyledSelect
                            value={departmentId}
                            onChange={setDepartmentId}
                            options={[{ value: 0, label: t("devices.pickDepartment") }, ...owners.departments]}
                            triggerClassName={`${fieldClassName} pr-8`}
                        />
                    </label>
                </div>
                <label className="block">
                    <span className={fieldLabelClassName}>{t("devices.scope")}</span>
                    <StyledSelect value={scope} onChange={setScope} options={scopeOptions} triggerClassName={`${fieldClassName} pr-8`} />
                </label>
                <label className="block">
                    <span className={fieldLabelClassName}>{t("devices.access")}</span>
                    <StyledSelect value={accessLevel} onChange={setAccessLevel} options={accessLevelOptions} triggerClassName={`${fieldClassName} pr-8`} />
                </label>
                {scope === "machines" && (
                    <div>
                        <span className={fieldLabelClassName}>{t("common.machine")}</span>
                        <MultiSelect
                            options={machineOptions ?? []}
                            values={machineIds}
                            onChange={setMachineIds}
                            placeholder={machineOptions === null ? t("common.loading") : t("devices.machinesPlaceholder")}
                            disabled={machineOptions === null}
                            maxVisible={100}
                        />
                    </div>
                )}
                <label className="block">
                    <span className={fieldLabelClassName}>{t("common.note")}</span>
                    <input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={255}
                        placeholder={t("devices.notePlaceholder")}
                        className={fieldClassName}
                    />
                </label>
            </FormDialog>

            <FormDialog
                isOpen={naming !== null}
                title={t("devices.alias")}
                onClose={() => setNaming(null)}
                onSubmit={handleAlias}
                loading={busy}
                submitLabel={t("common.save")}
                cancelLabel={t("common.cancel")}
            >
                <p className="break-all text-sm text-[#5e3f3a]">
                    {naming?.friendlyName || `${naming?.vendorId}:${naming?.productId}`} · {naming?.serialNumber || t("common.noSerial")}
                </p>
                <input
                    value={alias}
                    onChange={(event) => setAlias(event.target.value)}
                    maxLength={100}
                    autoFocus
                    aria-label={t("devices.alias")}
                    placeholder={t("devices.aliasPlaceholder")}
                    className={fieldClassName}
                />
            </FormDialog>

            <ConfirmDialog
                isOpen={revoking !== null}
                title={t("common.revokeTitle")}
                message={t("devices.revokeMessage", { usb: revoking ? usbLabel(revoking) : "" })}
                onApprove={handleRevoke}
                onDenied={() => setRevoking(null)}
                approveLabel={t("common.revoke")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />
        </div>
    );
}
