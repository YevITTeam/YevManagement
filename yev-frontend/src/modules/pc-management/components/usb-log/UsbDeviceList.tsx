"use client";

import { useState } from "react";
import { Layers, Lock, Pencil, ShieldCheck, ShieldOff, Tag } from "lucide-react";
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
import { ErrorBar, FilterActions, IconButton, IconFlag, ListToolbar, SearchField, TableStatusRows, fieldClassName, rowClassName, theadRowClassName } from "./UsbListToolbar";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";
import UsbPolicyBar from "./UsbPolicyBar";
import { ACCESS_LEVEL_OPTIONS, DEVICE_CLASSES, USB_ACCESS_LEVEL, deviceClassLabel, formatBytes, formatDateTime, usbLabel } from "./usb-log-format";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const dialogFieldClassName = `${fieldClassName} w-full`;

type ApprovalFilter = "" | "approved" | "notApproved";

const emptyFilters = { keyword: "", approval: "" as ApprovalFilter, deviceClass: "", branchId: 0, departmentId: 0 };

const APPROVAL_OPTIONS: { value: ApprovalFilter; key: string }[] = [
    { value: "", key: "devices.allApproval" },
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
    const [pageSize, setPageSize] = usePersistedState("page-size:pc-management/components/usb-log/UsbDeviceList", PAGE_SIZE);
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
    const classOptions = [{ value: "", label: t("devices.allClasses") }, ...DEVICE_CLASSES.map((value) => ({ value, label: deviceClassLabel(t, value) }))];
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
                pageSize,
                keyword: applied.keyword || undefined,
                isApproved: applied.approval === "" ? undefined : applied.approval === "approved",
                deviceClass: applied.deviceClass || undefined,
                branchId: applied.branchId || undefined,
                departmentId: applied.departmentId || undefined,
                ...sort,
            }),
        [pageIndex, pageSize, applied, sort],
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

    const summary = isLoading ? t("common.loadingData") : t("common.shownDevices", { shown: rows.length, total: totalCount });
    const columns = canApprove ? 6 : 5;

    return (
        <div className="space-y-3">
            <UsbPolicyBar canEdit={canApprove} />

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <ListToolbar
                    actions={<UsbExportButton items={[{ label: t("devices.export"), fallbackFileName: "ThietBiUSB.xlsx", download: () => UsbLogApi.exportDevices(exportFilter()) }]} />}
                >
                    <SearchField value={draft.keyword} onChange={(keyword) => setDraft({ ...draft, keyword })} onEnter={handleSearch} placeholder={t("devices.searchPlaceholder")} />
                    <div className="w-[calc(50%-0.25rem)] sm:w-40">
                        <StyledSelect
                            value={draft.approval}
                            onChange={(approval) => setDraft({ ...draft, approval })}
                            options={approvalOptions}
                            ariaLabel={t("common.approve")}
                            triggerClassName={`${dialogFieldClassName} pr-8`}
                        />
                    </div>
                    <div className="w-[calc(50%-0.25rem)] sm:w-36">
                        <StyledSelect
                            value={draft.deviceClass}
                            onChange={(deviceClass) => setDraft({ ...draft, deviceClass })}
                            options={classOptions}
                            ariaLabel={t("devices.class")}
                            triggerClassName={`${dialogFieldClassName} pr-8`}
                        />
                    </div>
                    <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} onRefresh={() => refetch()} disabled={isLoading} />
                </ListToolbar>

                <ErrorBar message={error} />

                <TableScroll className="relative">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className={theadRowClassName}>
                                <SortableTh label={t("devices.device")} sortKey="name" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="hidden px-3 py-2 md:table-cell">{t("common.owner")}</th>
                                <SortableTh label={t("common.approve")} sortKey="isApproved" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <SortableTh label={t("common.lastSeen")} sortKey="lastSeenAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label={t("common.sessionCount")} sortKey="sessionCount" sort={sort} onSort={handleSort} className="hidden px-3 py-2 text-right lg:table-cell" />
                                {canApprove && (
                                    <th className="px-3 py-2">
                                        <span className="sr-only">{t("common.actions")}</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={columns} />
                            {rows.map((row) => {
                                const isDisk = row.deviceClass === "DiskDrive";
                                const isApproved = row.isApproved || row.approvedMachines.length > 0;
                                return (
                                    <tr key={row.id} className={`${rowClassName} align-top`}>
                                        <td className="px-3 py-2 text-[#191c1e]">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-semibold">{usbLabel(row)}</span>
                                                {row.isSharedSerial && <IconFlag icon={Layers} tone="warning" label={t("devices.sharedSerialTitle")} />}
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
                                        <td className="hidden px-3 py-2 text-[#191c1e] md:table-cell">
                                            <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                        </td>
                                        <td className="px-3 py-2">
                                            {isApproved ? (
                                                <div title={row.approvedBy ? `${row.approvedBy}, ${formatDateTime(row.approvedAt)}` : undefined} className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <Badge variant="success">{row.isApproved ? t("devices.allMachines") : t("devices.machineCount", { count: row.approvedMachines.length })}</Badge>
                                                        {row.accessLevel === USB_ACCESS_LEVEL.ReadOnly && <IconFlag icon={Lock} tone="warning" label={t("accessLevel.readOnly")} />}
                                                    </div>
                                                    {row.approvedMachines.length > 0 && (
                                                        <div className="text-xs text-[#191c1e]" title={row.approvedMachines.map((m) => m.deviceCode).join(", ")}>
                                                            {row.approvedMachines
                                                                .slice(0, 3)
                                                                .map((m) => m.deviceCode)
                                                                .join(", ")}
                                                            {row.approvedMachines.length > 3 && ` +${row.approvedMachines.length - 3}`}
                                                        </div>
                                                    )}
                                                    {row.approvalNote && <div className="text-xs text-[#5e3f3a]">{row.approvalNote}</div>}
                                                </div>
                                            ) : isDisk ? (
                                                <Badge variant="neutral">{t("common.notApproved")}</Badge>
                                            ) : (
                                                <span className="text-xs text-[#8a8f94]">{t("devices.logOnly")}</span>
                                            )}
                                        </td>
                                        <td className="hidden px-3 py-2 text-[#5e3f3a] lg:table-cell">
                                            <div className="whitespace-nowrap tabular-nums">{formatDateTime(row.lastSeenAt)}</div>
                                            {row.lastMachineName && <div className="text-xs">{row.lastMachineName}</div>}
                                        </td>
                                        <td className="hidden px-3 py-2 text-right tabular-nums text-[#191c1e] lg:table-cell">{row.sessionCount}</td>
                                        {canApprove && (
                                            <td className="px-2 py-1.5">
                                                {/* Alias last: it exists on every row, so it stays in one column while the approval icons vary. */}
                                                <div className="flex justify-end gap-0.5">
                                                    {isApproved ? (
                                                        <>
                                                            <IconButton icon={Pencil} label={t("devices.edit")} size="sm" variant="ghost" onClick={() => openApprove(row)} />
                                                            <IconButton icon={ShieldOff} label={t("common.revoke")} size="sm" variant="danger" onClick={() => setRevoking(row)} />
                                                        </>
                                                    ) : (
                                                        isDisk &&
                                                        row.serialNumber && <IconButton icon={ShieldCheck} label={t("common.approve")} size="sm" variant="ghost" onClick={() => openApprove(row)} />
                                                    )}
                                                    <IconButton icon={Tag} label={t("devices.setAlias")} size="sm" variant="ghost" onClick={() => openAlias(row)} />
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableScroll>

                <Pagination pageSize={pageSize} onPageSizeChange={setPageSize} pageIndex={pageIndex} totalPages={totalPages} onPageChange={setPageIndex} disabled={isLoading} summary={summary} compactSummary={summary} />
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
                            triggerClassName={`${dialogFieldClassName} pr-8`}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("common.department")}</span>
                        <StyledSelect
                            value={departmentId}
                            onChange={setDepartmentId}
                            options={[{ value: 0, label: t("devices.pickDepartment") }, ...owners.departments]}
                            triggerClassName={`${dialogFieldClassName} pr-8`}
                        />
                    </label>
                </div>
                <label className="block">
                    <span className={fieldLabelClassName}>{t("devices.scope")}</span>
                    <StyledSelect value={scope} onChange={setScope} options={scopeOptions} triggerClassName={`${dialogFieldClassName} pr-8`} />
                </label>
                <label className="block">
                    <span className={fieldLabelClassName}>{t("devices.access")}</span>
                    <StyledSelect value={accessLevel} onChange={setAccessLevel} options={accessLevelOptions} triggerClassName={`${dialogFieldClassName} pr-8`} />
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
                        className={dialogFieldClassName}
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
                    className={dialogFieldClassName}
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
