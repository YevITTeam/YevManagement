"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { Bell, CheckCircle2, ChevronDown, Link2, Mail, Plus, Search, Star, Trash2, UserMinus, X } from "lucide-react";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import { SupplierApi } from "@/modules/pc-management/api/supplier.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import { DeviceGroupApi } from "@/modules/pc-management/api/device-group.api";
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import { IpApi } from "@/modules/pc-management/api/ip-api";
import { UserEmailApi } from "@/modules/auth/api/user-email.api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import type { IpAddressDto } from "@/modules/pc-management/types/ip.dto";
import type { DomainAccountEmailStatusDto, UserEmailOverviewDto } from "@/modules/auth/types/user-email.dto";
import type { DeviceEmailInputDto, DeviceGetDto, DeviceIpAddressDto } from "@/modules/pc-management/types/device.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";

export interface DeviceFormValues {
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    groupId: number | null;
    departmentId: number | null;
    manager: string;
    managerDomainAccount: string | null;
    emails: DeviceEmailInputDto[];
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string;
    serialNumber: string | null;
    isUseUsb: boolean;
    requiresDailyCheck: boolean;
    ipAddressIds: number[];
}

interface DeviceFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DeviceGetDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DeviceFormValues) => void | Promise<void>;
}

const statusOptions = [
    { value: 0, label: "Chờ sử dụng", dotClassName: "bg-[#94a3b8]" },
    { value: 1, label: "Đang sử dụng", dotClassName: "bg-[#16a34a]" },
    { value: 2, label: "Chờ thanh lý", dotClassName: "bg-[#f59e0b]" },
    { value: 3, label: "Đã thanh lý", dotClassName: "bg-[#dc2626]" },
];

const emptyValues: DeviceFormValues = {
    deviceCode: "",
    deviceName: "",
    deviceTypeId: 0,
    supplierId: 0,
    branchId: 0,
    groupId: null,
    departmentId: null,
    manager: "",
    managerDomainAccount: "",
    emails: [],
    purchaseDate: "",
    depreciationMonths: 36,
    isOutsourced: false,
    status: 0,
    note: "",
    serialNumber: "",
    isUseUsb: false,
    requiresDailyCheck: false,
    ipAddressIds: [],
};

function toDateInputValue(value: string | null | undefined) {
    if (!value) return "";
    return value.slice(0, 10);
}

// Same shape the BE enforces (DOMAIN\user), so Identity can match the account.
const DOMAIN_ACCOUNT_REGEX = /^[^\\\s]+\\[^\\\s]+$/;
const DOMAIN_ACCOUNT_HINT = "Nhập theo dạng DOMAIN\\username, vd YEV\\nam.nguyen";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldLabelClassName = "mb-1.5 block text-xs font-medium text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";
const selectTriggerClassName = `${fieldClassName} pr-9`;
// Borderless until hovered or focused, so the email list reads as a list rather than a stack of boxes.
const ghostInputClassName =
    "h-8 rounded-md border border-transparent bg-transparent px-2 text-[13px] text-[#191c1e] outline-none transition hover:border-[#e0e3e5] focus:border-[#e3000f] focus:bg-white focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed";
const linkButtonClassName =
    "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#e3000f] transition hover:text-[#b40009] disabled:cursor-not-allowed disabled:opacity-50";

export default function DeviceForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DeviceFormProps) {
    const [values, setValues] = useState<DeviceFormValues>(emptyValues);
    const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDto[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [deviceGroups, setDeviceGroups] = useState<DeviceGroupDto[]>([]);
    const [deviceDepartments, setDeviceDepartments] = useState<DeviceDepartmentDto[]>([]);
    const [availableIps, setAvailableIps] = useState<IpAddressDto[]>([]);
    const [ipSearch, setIpSearch] = useState("");
    const [ipDropdownOpen, setIpDropdownOpen] = useState(false);
    const [selectedIps, setSelectedIps] = useState<DeviceIpAddressDto[]>([]);
    const ipPickerRef = useRef<HTMLDivElement>(null);
    const [newEmail, setNewEmail] = useState("");
    const { user } = useAuth();
    const canSyncIdentity = hasPermission(user, "Identity.UserEmail.Manage");
    const [identityStatus, setIdentityStatus] = useState<DomainAccountEmailStatusDto | null>(null);
    const [identityOverview, setIdentityOverview] = useState<UserEmailOverviewDto | null>(null);
    const [isSyncingIdentity, setIsSyncingIdentity] = useState(false);
    const [pendingIdentityDelete, setPendingIdentityDelete] = useState<{ id: number; email: string } | null>(null);

    useEffect(() => {
        DeviceTypeApi.getAllDeviceTypes().then((data) => setDeviceTypes(data)).catch((err) => console.error(err));
        SupplierApi.getAllSuppliers().then((data) => setSuppliers(data)).catch((err) => console.error(err));
        BranchApi.getAllBranches().then((data) => setBranches(data)).catch((err) => console.error(err));
        DeviceDepartmentApi.getAllDeviceDepartments().then((data) => setDeviceDepartments(data)).catch((err) => console.error(err));
    }, []);

    // Nhóm cascading theo Bộ phận đã chọn (docs/asset-module.md §4) — chưa chọn Bộ phận thì
    // danh sách Nhóm rỗng và dropdown Nhóm bị disable. Reset "về rỗng" tính ngay trong render
    // (so sánh snapshot) — effect chỉ còn lo phần fetch thật (đã là .then()/.catch() thuần).
    const departmentKey = `${isOpen}|${values.departmentId}`;
    const [prevDepartmentKey, setPrevDepartmentKey] = useState(departmentKey);
    if (prevDepartmentKey !== departmentKey) {
        setPrevDepartmentKey(departmentKey);
        if (!isOpen || !values.departmentId) setDeviceGroups([]);
    }

    useEffect(() => {
        if (!isOpen || !values.departmentId) return;
        DeviceGroupApi.getAllDeviceGroups(values.departmentId)
            .then((data) => setDeviceGroups(data))
            .catch((err) => console.error(err));
    }, [isOpen, values.departmentId]);

    // Tải danh sách IP còn trống (không phân trang) theo từ khoá tìm kiếm, có debounce.
    useEffect(() => {
        if (!isOpen) return;
        const handle = setTimeout(() => {
            IpApi.getAvailableIpAddress(ipSearch.trim() || undefined)
                .then((data) => setAvailableIps(data))
                .catch((err) => console.error(err));
        }, 300);
        return () => clearTimeout(handle);
    }, [isOpen, ipSearch]);

    // Identity's view of the typed domain account (does the user exist, which emails it holds), debounced.
    const domainAccount = (values.managerDomainAccount ?? "").trim();
    const hasValidDomainAccount = DOMAIN_ACCOUNT_REGEX.test(domainAccount);
    useEffect(() => {
        if (!isOpen || !canSyncIdentity || !hasValidDomainAccount) return;
        const handle = setTimeout(() => {
            UserEmailApi.getByDomainAccount(domainAccount)
                .then((data) => {
                    setIdentityStatus(data);
                    if (!data.userId) {
                        setIdentityOverview(null);
                        return;
                    }
                    return UserEmailApi.getOverview(data.userId).then((overview) => setIdentityOverview(overview));
                })
                .catch((err) => console.error(err));
        }, 400);
        return () => clearTimeout(handle);
    }, [isOpen, canSyncIdentity, hasValidDomainAccount, domainAccount]);

    // Đóng dropdown IP khi click ra ngoài.
    useEffect(() => {
        if (!ipDropdownOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (ipPickerRef.current && !ipPickerRef.current.contains(event.target as Node)) {
                setIpDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ipDropdownOpen]);

    useDialogReset(isOpen, initial, (current) => {
        setIpSearch("");
        setNewEmail("");
        setIpDropdownOpen(false);
        setIdentityStatus(null);
        setIdentityOverview(null);
        setSelectedIps(current?.ipAddresses ?? []);
        setValues(
            current
                ? {
                      deviceCode: current.deviceCode,
                      deviceName: current.deviceName,
                      deviceTypeId: current.deviceTypeId,
                      supplierId: current.supplierId,
                      branchId: current.branchId,
                      groupId: current.groupId,
                      departmentId: current.departmentId,
                      manager: current.manager,
                      managerDomainAccount: current.managerDomainAccount ?? "",
                      emails: current.emails.map((item) => ({ email: item.email, note: item.note })),
                      purchaseDate: toDateInputValue(current.purchaseDate),
                      depreciationMonths: current.depreciationMonths,
                      isOutsourced: current.isOutsourced,
                      status: current.status,
                      note: current.note ?? "",
                      serialNumber: current.serialNumber ?? "",
                      isUseUsb: current.isUseUsb,
                      requiresDailyCheck: current.requiresDailyCheck,
                      ipAddressIds: current.ipAddresses.map((ip) => ip.id),
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const isLiquidationStatus = values.status === 2 || values.status === 3;

    const handleStatusChange = (nextStatus: number) => {
        handleChange("status", nextStatus);
        if (nextStatus === 2 || nextStatus === 3) {
            // BE tự gỡ hết IP khi máy chuyển Chờ thanh lý/Đã thanh lý (docs/asset-module.md §1.15) —
            // đồng bộ luôn ở FE để không hiển thị IP đã chọn nhưng thực ra sẽ không được lưu.
            setSelectedIps([]);
            handleChange("ipAddressIds", []);
        }
    };

    const handleAddIp = (ip: DeviceIpAddressDto) => {
        if (values.ipAddressIds.includes(ip.id)) {
            setIpDropdownOpen(false);
            setIpSearch("");
            return;
        }
        setSelectedIps((current) => [...current, ip]);
        handleChange("ipAddressIds", [...values.ipAddressIds, ip.id]);
        setIpDropdownOpen(false);
        setIpSearch("");
    };

    const handleRemoveIp = (ipId: number) => {
        setSelectedIps((current) => current.filter((ip) => ip.id !== ipId));
        handleChange(
            "ipAddressIds",
            values.ipAddressIds.filter((id) => id !== ipId)
        );
    };

    const handleChange = <K extends keyof DeviceFormValues>(field: K, value: DeviceFormValues[K]) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleEmailChange = (index: number, field: "email" | "note", value: string) => {
        setValues((current) => ({
            ...current,
            emails: current.emails.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: field === "note" ? (value.trim() ? value : null) : value } : item
            ),
        }));
    };

    // Adds the address typed in the list's last row (Enter or the "Thêm" button).
    const handleAddEmail = () => {
        const email = newEmail.trim();
        if (!email) return;
        if (!EMAIL_REGEX.test(email)) {
            toast.error("Email không hợp lệ.");
            return;
        }
        if (values.emails.some((item) => item.email.trim().toLowerCase() === email.toLowerCase())) {
            toast.info("Email đã có trong danh sách.");
            return;
        }
        setValues((current) => ({ ...current, emails: [...current.emails, { email, note: null }] }));
        setNewEmail("");
    };

    const handleRemoveEmail = (index: number) => {
        setValues((current) => ({ ...current, emails: current.emails.filter((_, itemIndex) => itemIndex !== index) }));
    };

    // Only trust the status fetched for the account currently typed.
    const currentIdentityStatus =
        identityStatus && identityStatus.domainAccount.toLowerCase() === domainAccount.toLowerCase() ? identityStatus : null;
    const identityEmailKeys = new Set((currentIdentityStatus?.emails ?? []).map((email) => email.toLowerCase()));
    const isEmailOnIdentity = (email: string) => identityEmailKeys.has(email.trim().toLowerCase());
    const pendingSyncEmails = values.emails.filter((item) => EMAIL_REGEX.test(item.email.trim()) && !isEmailOnIdentity(item.email));

    const handleSyncEmails = async (items: DeviceEmailInputDto[]) => {
        if (!hasValidDomainAccount || items.length === 0) return;
        setIsSyncingIdentity(true);
        try {
            const result = await UserEmailApi.linkDomainAccount({
                domainAccount,
                fullName: values.manager.trim().slice(0, 100) || null,
                emails: items.map((item) => ({ email: item.email.trim(), note: item.note?.trim() ? item.note.trim() : null })),
            });
            const parts = [`Đã đồng bộ ${result.addedEmails.length} email lên Identity`];
            if (result.userCreated) parts.push(`đã tạo tài khoản ${result.userName}`);
            toast.success(parts.join(", "));
            const status = await UserEmailApi.getByDomainAccount(domainAccount);
            setIdentityStatus(status);
            setIdentityOverview(status.userId ? await UserEmailApi.getOverview(status.userId) : null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Đồng bộ email lên Identity thất bại."));
        } finally {
            setIsSyncingIdentity(false);
        }
    };

    const currentOverview =
        identityOverview && identityOverview.userName.toLowerCase() === domainAccount.toLowerCase() ? identityOverview : null;
    const findIdentityEmail = (email: string) =>
        currentOverview?.emails.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());

    // A module sends to exactly one address: ticking moves the module to this email, unticking sends it back to the primary.
    const handleToggleModule = async (userEmailId: number, moduleCode: string, checked: boolean) => {
        if (!currentOverview) return;
        setIsSyncingIdentity(true);
        try {
            const next = await UserEmailApi.updateModules(currentOverview.userId, {
                items: currentOverview.modules.map((m) => ({
                    moduleCode: m.moduleCode,
                    userEmailId: m.moduleCode === moduleCode ? (checked ? userEmailId : null) : m.userEmailId,
                })),
            });
            setIdentityOverview(next);
            toast.success("Đã lưu cấu hình email theo module");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Lưu cấu hình email theo module thất bại."));
        } finally {
            setIsSyncingIdentity(false);
        }
    };

    // Addresses Identity holds for the account that the device does not list yet.
    const identityOnlyEmails = (currentOverview?.emails ?? []).filter(
        (identityEmail) => !values.emails.some((item) => item.email.trim().toLowerCase() === identityEmail.email.toLowerCase())
    );

    const handlePullIdentityEmails = (emails: string[]) => {
        setValues((current) => ({
            ...current,
            emails: [...current.emails.filter((item) => item.email.trim()), ...emails.map((email) => ({ email, note: null }))],
        }));
    };

    // Removes the address from Identity only; the device's own email list is untouched.
    const handleDeleteIdentityEmail = async () => {
        if (!currentOverview || !pendingIdentityDelete) return;
        setIsSyncingIdentity(true);
        try {
            const next = await UserEmailApi.remove(currentOverview.userId, pendingIdentityDelete.id);
            setIdentityOverview(next);
            setIdentityStatus((status) => (status ? { ...status, emails: next.emails.map((item) => item.email) } : status));
            toast.success("Đã xoá email khỏi Identity");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xoá email khỏi Identity thất bại."));
        } finally {
            setIsSyncingIdentity(false);
            setPendingIdentityDelete(null);
        }
    };

    const handleSetPrimaryOnIdentity = async (userEmailId: number) => {
        if (!currentOverview) return;
        setIsSyncingIdentity(true);
        try {
            setIdentityOverview(await UserEmailApi.setPrimary(currentOverview.userId, userEmailId));
            toast.success("Đã đặt email chính");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Đặt email chính thất bại."));
        } finally {
            setIsSyncingIdentity(false);
        }
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedEmails = values.emails
            .map((item) => ({ email: item.email.trim(), note: item.note?.trim() ? item.note.trim() : null }))
            .filter((item) => item.email);

        if (
            !values.deviceCode.trim() ||
            !values.deviceName.trim() ||
            !values.deviceTypeId ||
            !values.supplierId ||
            !values.branchId ||
            !values.purchaseDate ||
            !values.note.trim()
        ) {
            return;
        }
        onSubmit({
            ...values,
            manager: values.manager.trim(),
            managerDomainAccount: domainAccount || null,
            emails: trimmedEmails,
            note: values.note.trim(),
            serialNumber: values.serialNumber?.trim() ? values.serialNumber : null,
        });
    };

    const closeIfIdle = () => !loading && onClose();

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={closeIfIdle} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-form-title"
                className="z-60 flex max-h-full w-full max-w-5xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <h3 id="device-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm thiết bị" : "Cập nhật thiết bị"}
                    </h3>
                    <button
                        type="button"
                        onClick={closeIfIdle}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 divide-y divide-[#f1f5f9] overflow-y-auto px-6 py-5">
                        <FormSection title="Thông tin chung">
                            <label className="block">
                                <span className={fieldLabelClassName}>Mã thiết bị<RequiredMark /></span>
                                <input
                                    value={values.deviceCode}
                                    onChange={(event) => handleChange("deviceCode", event.target.value)}
                                    disabled={loading}
                                    autoFocus
                                    required
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Tên thiết bị<RequiredMark /></span>
                                <input
                                    value={values.deviceName}
                                    onChange={(event) => handleChange("deviceName", event.target.value)}
                                    disabled={loading}
                                    required
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Loại thiết bị<RequiredMark /></span>
                                <SearchableSelect
                                    options={deviceTypes.map((type) => ({ value: type.id, label: type.typeName, searchText: type.typeName.toLowerCase() }))}
                                    value={values.deviceTypeId || ""}
                                    onChange={(v) => handleChange("deviceTypeId", v === "" ? 0 : v)}
                                    placeholder="Chọn loại"
                                    disabled={loading}
                                    triggerClassName={selectTriggerClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Trạng thái</span>
                                <StyledSelect
                                    value={values.status}
                                    onChange={handleStatusChange}
                                    disabled={loading}
                                    triggerClassName={selectTriggerClassName}
                                    options={statusOptions}
                                />
                            </label>
                        </FormSection>

                        <FormSection title="Sử dụng">
                            <label className="block">
                                <span className={fieldLabelClassName}>Chi nhánh<RequiredMark /></span>
                                <SearchableSelect
                                    options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                                    value={values.branchId || ""}
                                    onChange={(v) => handleChange("branchId", v === "" ? 0 : v)}
                                    placeholder="Chọn chi nhánh"
                                    disabled={loading}
                                    triggerClassName={selectTriggerClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Bộ phận</span>
                                <SearchableSelect
                                    options={deviceDepartments.map((d) => ({ value: d.id, label: d.departmentName, searchText: d.departmentName.toLowerCase() }))}
                                    value={values.departmentId ?? ""}
                                    onChange={(v) => {
                                        // A group belongs to one department, so changing the department clears the group.
                                        setValues((current) => ({ ...current, departmentId: v === "" ? null : v, groupId: null }));
                                    }}
                                    placeholder="Không gán"
                                    disabled={loading}
                                    triggerClassName={selectTriggerClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Nhóm</span>
                                <SearchableSelect
                                    options={deviceGroups.map((g) => ({ value: g.id, label: g.groupName, searchText: g.groupName.toLowerCase() }))}
                                    value={values.groupId ?? ""}
                                    onChange={(v) => handleChange("groupId", v === "" ? null : v)}
                                    placeholder={values.departmentId ? "Không gán" : "Chọn bộ phận trước"}
                                    disabled={loading || !values.departmentId}
                                    triggerClassName={selectTriggerClassName}
                                />
                            </label>

                            <div className="relative" ref={ipPickerRef}>
                                <span className={fieldLabelClassName}>Địa chỉ IP</span>
                                {isLiquidationStatus ? (
                                    <div
                                        className={`${fieldClassName} flex items-center bg-[#f8fafc] text-[#8a8f94]`}
                                        title="Thiết bị Chờ thanh lý/Đã thanh lý không giữ địa chỉ IP — hệ thống tự gỡ để cấp cho thiết bị khác."
                                    >
                                        Tự gỡ khi thanh lý
                                    </div>
                                ) : (
                                    <div
                                        className={`flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border bg-white py-1 pl-1.5 pr-1 transition ${
                                            ipDropdownOpen ? "border-[#e3000f] ring-2 ring-[#ffe0e3]" : "border-[#e0e3e5]"
                                        }`}
                                    >
                                        {selectedIps.map((ip) => (
                                            <span
                                                key={ip.id}
                                                className="inline-flex h-6 items-center gap-1 rounded-md bg-[#f2f4f6] pl-2 pr-0.5 text-xs font-medium tabular-nums text-[#191c1e]"
                                            >
                                                {ip.ipAddress}
                                                <button
                                                    type="button"
                                                    onClick={() => !loading && handleRemoveIp(ip.id)}
                                                    disabled={loading}
                                                    className="flex size-5 cursor-pointer items-center justify-center rounded text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#e3000f] disabled:cursor-not-allowed"
                                                    aria-label={`Gỡ IP ${ip.ipAddress}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => !loading && setIpDropdownOpen((open) => !open)}
                                            disabled={loading}
                                            aria-label="Thêm địa chỉ IP"
                                            aria-expanded={ipDropdownOpen}
                                            className="flex h-6 min-w-16 flex-1 cursor-pointer items-center justify-between gap-1 px-1 text-left text-sm text-[#8a8f94] disabled:cursor-not-allowed"
                                        >
                                            <span>{selectedIps.length === 0 ? "Chọn IP" : ""}</span>
                                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${ipDropdownOpen ? "rotate-180" : ""}`} />
                                        </button>
                                    </div>
                                )}

                                {ipDropdownOpen && !isLiquidationStatus && (
                                    <div className="absolute left-0 top-full z-70 mt-1 w-full overflow-hidden rounded-lg border border-[#e0e3e5] bg-white shadow-lg">
                                        <div className="border-b border-[#f1f5f9] p-1.5">
                                            <div className="flex items-center gap-1.5 rounded-md bg-[#f8fafc] px-2">
                                                <Search className="h-3.5 w-3.5 shrink-0 text-[#8a8f94]" />
                                                <input
                                                    value={ipSearch}
                                                    onChange={(event) => setIpSearch(event.target.value)}
                                                    placeholder="Tìm IP"
                                                    autoFocus
                                                    className="h-7 w-full min-w-0 bg-transparent text-sm text-[#191c1e] outline-none"
                                                />
                                            </div>
                                        </div>
                                        <ul className="max-h-44 overflow-y-auto py-1 text-sm text-[#191c1e]">
                                            {availableIps
                                                .filter((ip) => !values.ipAddressIds.includes(ip.id))
                                                .map((ip) => (
                                                    <li key={ip.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddIp({ id: ip.id, ipAddress: ip.ipAddress })}
                                                            className="w-full cursor-pointer px-3 py-1.5 text-left tabular-nums transition hover:bg-[#fff4f2] hover:text-[#e3000f]"
                                                        >
                                                            {ip.ipAddress}
                                                        </button>
                                                    </li>
                                                ))}
                                            {availableIps.filter((ip) => !values.ipAddressIds.includes(ip.id)).length === 0 && (
                                                <li className="px-3 py-2 text-xs text-[#5e3f3a]">
                                                    {(() => {
                                                        const trimmedSearch = ipSearch.trim();
                                                        const isFullIpFormat = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmedSearch);
                                                        const alreadyAddedToThisDevice = selectedIps.some((ip) => ip.ipAddress === trimmedSearch);
                                                        if (alreadyAddedToThisDevice) {
                                                            return `IP ${trimmedSearch} đã được thêm vào thiết bị này rồi.`;
                                                        }
                                                        // `/available` only returns unused IPs (docs/asset-module.md §4): a full address with no
                                                        // match is taken by another device or unknown, not a search failure.
                                                        if (isFullIpFormat) {
                                                            return `IP ${trimmedSearch} không còn trống — đang dùng cho thiết bị khác hoặc không tồn tại.`;
                                                        }
                                                        return "Không tìm thấy IP trống";
                                                    })()}
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </FormSection>

                        <FormSection title="Mua sắm">
                            <label className="block">
                                <span className={fieldLabelClassName}>Nhà cung cấp<RequiredMark /></span>
                                <SearchableSelect
                                    options={suppliers.map((s) => ({ value: s.id, label: s.supplierName, searchText: s.supplierName.toLowerCase() }))}
                                    value={values.supplierId || ""}
                                    onChange={(v) => handleChange("supplierId", v === "" ? 0 : v)}
                                    placeholder="Chọn nhà cung cấp"
                                    disabled={loading}
                                    triggerClassName={selectTriggerClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Số serial</span>
                                <input
                                    value={values.serialNumber ?? ""}
                                    onChange={(event) => handleChange("serialNumber", event.target.value)}
                                    disabled={loading}
                                    maxLength={100}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Ngày mua<RequiredMark /></span>
                                <input
                                    type="date"
                                    value={values.purchaseDate}
                                    onChange={(event) => handleChange("purchaseDate", event.target.value)}
                                    disabled={loading}
                                    required
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>Khấu hao<RequiredMark /></span>
                                <span className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={600}
                                        value={values.depreciationMonths}
                                        onChange={(event) => handleChange("depreciationMonths", Number(event.target.value))}
                                        disabled={loading}
                                        required
                                        className={fieldClassName.replace("w-full", "w-24")}
                                    />
                                    <span className="text-xs text-[#8a8f94]">tháng</span>
                                </span>
                            </label>
                        </FormSection>

                        <FormSection title="Người dùng">
                            <label className="block">
                                <span className={fieldLabelClassName}>Người quản lý</span>
                                <input
                                    value={values.manager}
                                    onChange={(event) => handleChange("manager", event.target.value)}
                                    disabled={loading}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block lg:col-span-2">
                                <span className={fieldLabelClassName}>Tài khoản domain</span>
                                <input
                                    value={values.managerDomainAccount ?? ""}
                                    onChange={(event) => handleChange("managerDomainAccount", event.target.value)}
                                    placeholder="YEV\username"
                                    disabled={loading}
                                    maxLength={150}
                                    pattern={DOMAIN_ACCOUNT_REGEX.source}
                                    title={DOMAIN_ACCOUNT_HINT}
                                    className={fieldClassName}
                                />
                            </label>

                        </FormSection>

                        <FormSection title="Email" titleClassName={canSyncIdentity ? "lg:pt-0.5" : "lg:pt-2.5"}>
                            <div className="sm:col-span-2 lg:col-span-4">
                                {canSyncIdentity && (
                                    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <IdentityStatus
                                            hasValidDomainAccount={hasValidDomainAccount}
                                            status={currentIdentityStatus}
                                            domainAccount={domainAccount}
                                        />
                                        <span className="flex-1" />
                                        {currentOverview && identityOnlyEmails.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handlePullIdentityEmails(identityOnlyEmails.map((identityEmail) => identityEmail.email))}
                                                disabled={loading}
                                                className={linkButtonClassName}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Thêm tất cả từ Identity
                                            </button>
                                        )}
                                        {hasValidDomainAccount && pendingSyncEmails.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleSyncEmails(pendingSyncEmails)}
                                                disabled={loading || isSyncingIdentity}
                                                className={linkButtonClassName}
                                            >
                                                <Link2 className="h-3.5 w-3.5" />
                                                {isSyncingIdentity ? "Đang đồng bộ..." : `Đồng bộ lên Identity (${pendingSyncEmails.length})`}
                                            </button>
                                        )}
                                    </div>
                                )}

                                <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                                    {values.emails.map((item, index) => {
                                        const identityEmail = canSyncIdentity ? findIdentityEmail(item.email) : undefined;
                                        return (
                                            <li key={index} className="flex flex-wrap items-center gap-x-1 gap-y-1 px-1.5 py-1">
                                                {identityEmail?.isPrimary ? (
                                                    <span className="flex size-8 shrink-0 items-center justify-center text-[#e3000f]" title="Email chính">
                                                        <Star className="h-4 w-4 fill-current" />
                                                    </span>
                                                ) : identityEmail ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSetPrimaryOnIdentity(identityEmail.id)}
                                                        disabled={loading || isSyncingIdentity}
                                                        title="Đặt làm email chính"
                                                        aria-label="Đặt làm email chính"
                                                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#c9cdd1] transition hover:bg-[#fff4f2] hover:text-[#e3000f] disabled:cursor-not-allowed"
                                                    >
                                                        <Star className="h-4 w-4" />
                                                    </button>
                                                ) : (
                                                    <span className="flex size-8 shrink-0 items-center justify-center text-[#c9cdd1]">
                                                        <Mail className="h-4 w-4" />
                                                    </span>
                                                )}
                                                <input
                                                    type="email"
                                                    value={item.email}
                                                    onChange={(event) => handleEmailChange(index, "email", event.target.value)}
                                                    aria-label="Email"
                                                    disabled={loading}
                                                    className={`${ghostInputClassName} min-w-48 flex-1`}
                                                />
                                                <input
                                                    value={item.note ?? ""}
                                                    onChange={(event) => handleEmailChange(index, "note", event.target.value)}
                                                    placeholder="Ghi chú"
                                                    aria-label="Ghi chú email"
                                                    disabled={loading}
                                                    className={`${ghostInputClassName} w-36 shrink-0 text-[#5e3f3a]`}
                                                />
                                                {canSyncIdentity &&
                                                    (identityEmail && currentOverview ? (
                                                        <span className="flex shrink-0 items-center gap-1">
                                                            <Bell className="mx-1 h-3.5 w-3.5 text-[#8a8f94]" aria-label="Nhận thông báo" />
                                                            {currentOverview.modules.map((module) => {
                                                                const isAssigned = module.userEmailId === identityEmail.id;
                                                                const isImplicitPrimary = module.userEmailId === null && identityEmail.isPrimary;
                                                                const checked = isAssigned || isImplicitPrimary;
                                                                return (
                                                                    <label
                                                                        key={module.moduleCode}
                                                                        title={
                                                                            isImplicitPrimary
                                                                                ? `${module.moduleName}: đang gửi về email chính — chọn ở email khác để đổi`
                                                                                : `${module.moduleName}: ${checked ? "gửi thông báo về email này" : "bấm để gửi thông báo về email này"}${module.isApplied ? "" : " (module chưa áp dụng)"}`
                                                                        }
                                                                        className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#ffe0e3] ${
                                                                            checked
                                                                                ? "border-[#e9bcb6] bg-[#fff4f2] text-[#e3000f]"
                                                                                : "border-[#e0e3e5] text-[#8a8f94] hover:border-[#c9cdd1] hover:text-[#191c1e]"
                                                                        } ${isImplicitPrimary ? "cursor-default" : "cursor-pointer"} ${module.isApplied ? "" : "opacity-60"}`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            disabled={loading || isSyncingIdentity || isImplicitPrimary}
                                                                            onChange={(event) => handleToggleModule(identityEmail.id, module.moduleCode, event.target.checked)}
                                                                            className="sr-only"
                                                                        />
                                                                        {shortModuleName(module.moduleName)}
                                                                    </label>
                                                                );
                                                            })}
                                                        </span>
                                                    ) : isEmailOnIdentity(item.email) ? (
                                                        <span className="flex size-8 shrink-0 items-center justify-center text-[#16a34a]" title="Đã có trên Identity">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSyncEmails([item])}
                                                            disabled={loading || isSyncingIdentity || !hasValidDomainAccount || !EMAIL_REGEX.test(item.email.trim())}
                                                            title={hasValidDomainAccount ? "Thêm email này vào tài khoản trên Identity" : "Cần nhập Tài khoản domain hợp lệ trước"}
                                                            className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-[#c9cdd1] px-2.5 text-xs font-medium text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <Link2 className="h-3 w-3" />
                                                            Đồng bộ
                                                        </button>
                                                    ))}
                                                {identityEmail && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingIdentityDelete({ id: identityEmail.id, email: identityEmail.email })}
                                                        disabled={loading || isSyncingIdentity}
                                                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="Xoá email khỏi Identity (không xoá khỏi thiết bị)"
                                                        aria-label="Xoá email khỏi Identity"
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmail(index)}
                                                    disabled={loading}
                                                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="Xoá email"
                                                    aria-label="Xoá email"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </li>
                                        );
                                    })}

                                    {canSyncIdentity &&
                                        currentOverview &&
                                        identityOnlyEmails.map((identityEmail) => (
                                            <li key={`identity-${identityEmail.id}`} className="flex items-center gap-x-1 bg-[#f8fafc] px-1.5 py-1">
                                                <span className="flex size-8 shrink-0 items-center justify-center text-[#c9cdd1]">
                                                    <Mail className="h-4 w-4" />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate px-2 text-[13px] text-[#8a8f94]">{identityEmail.email}</span>
                                                <span className="hidden shrink-0 text-xs text-[#8a8f94] sm:inline">Có trên Identity</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePullIdentityEmails([identityEmail.email])}
                                                    disabled={loading}
                                                    className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-[#e3000f] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Thêm
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingIdentityDelete({ id: identityEmail.id, email: identityEmail.email })}
                                                    disabled={loading || isSyncingIdentity}
                                                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#fff4f2] hover:text-[#930006] disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="Xoá email khỏi Identity"
                                                    aria-label="Xoá email khỏi Identity"
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </button>
                                            </li>
                                        ))}

                                    <li className="flex items-center gap-x-1 px-1.5 py-1">
                                        <span className="flex size-8 shrink-0 items-center justify-center text-[#8a8f94]">
                                            <Plus className="h-4 w-4" />
                                        </span>
                                        <input
                                            type="email"
                                            value={newEmail}
                                            onChange={(event) => setNewEmail(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    handleAddEmail();
                                                }
                                            }}
                                            placeholder="Thêm email rồi nhấn Enter"
                                            aria-label="Thêm email"
                                            disabled={loading}
                                            className={`${ghostInputClassName} min-w-0 flex-1`}
                                        />
                                        {newEmail.trim() && (
                                            <button
                                                type="button"
                                                onClick={handleAddEmail}
                                                disabled={loading}
                                                className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md bg-[#e3000f] px-3 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Thêm
                                            </button>
                                        )}
                                    </li>
                                </ul>
                            </div>
                        </FormSection>

                        <FormSection title="Tuỳ chọn" titleClassName="lg:pt-0">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2 lg:col-span-4">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                                    <input
                                        type="checkbox"
                                        checked={values.isOutsourced}
                                        onChange={(event) => handleChange("isOutsourced", event.target.checked)}
                                        disabled={loading}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    Thiết bị thuê ngoài
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                                    <input
                                        type="checkbox"
                                        checked={values.isUseUsb}
                                        onChange={(event) => handleChange("isUseUsb", event.target.checked)}
                                        disabled={loading}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    Sử dụng USB
                                </label>
                                <label
                                    className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]"
                                    title="Thiết bị nằm trong phòng server, có dán mã QR và phải quét mỗi ngày"
                                >
                                    <input
                                        type="checkbox"
                                        checked={values.requiresDailyCheck}
                                        onChange={(event) => handleChange("requiresDailyCheck", event.target.checked)}
                                        disabled={loading}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    Kiểm tra hằng ngày (QR)
                                </label>
                            </div>
                        </FormSection>

                        <FormSection title="Ghi chú" required titleClassName="lg:pt-2">
                            <textarea
                                value={values.note}
                                onChange={(event) => handleChange("note", event.target.value)}
                                aria-label="Ghi chú"
                                disabled={loading}
                                required
                                rows={2}
                                className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc] sm:col-span-2 lg:col-span-4"
                            />
                        </FormSection>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-[#e0e3e5] px-6 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Đang lưu..." : mode === "create" ? "Tạo mới" : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>

            {/* Rendered outside the form overlay so it stacks above the form panel (z-60). */}
            <ConfirmDialog
                isOpen={pendingIdentityDelete !== null}
                title="Xoá email khỏi Identity"
                message={
                    <>
                        Xoá <strong>{pendingIdentityDelete?.email}</strong> khỏi tài khoản {domainAccount} trên Identity? Module đang gửi về email này sẽ quay về email chính. Email trên thiết bị không bị ảnh hưởng.
                    </>
                }
                approveLabel="Xoá"
                loading={isSyncingIdentity}
                onApprove={handleDeleteIdentityEmail}
                onDenied={() => setPendingIdentityDelete(null)}
            />
        </>
    );
}

// One form group: title on the left (aligned with the first input row via titleClassName) (above on small screens), fields in a 4-column grid on the right.
function FormSection({
    title,
    required = false,
    titleClassName = "lg:pt-7",
    children,
}: {
    title: string;
    required?: boolean;
    titleClassName?: string;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-x-6 gap-y-3 py-5 first:pt-0 last:pb-0 lg:grid-cols-[8rem_1fr]">
            <h4 className={`text-sm font-semibold text-[#191c1e] ${titleClassName}`}>
                {title}
                {required && <RequiredMark />}
            </h4>
            <div className="grid content-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        </section>
    );
}

// Drops the trailing "(Attendance)"-style suffix so module toggles stay short; the full name stays in `title`.
function shortModuleName(moduleName: string) {
    return moduleName.replace(/\s*\([^)]*\)\s*$/, "") || moduleName;
}

// One-line Identity state for the device's domain account; the long explanation lives in `title`.
function IdentityStatus({
    hasValidDomainAccount,
    status,
    domainAccount,
}: {
    hasValidDomainAccount: boolean;
    status: DomainAccountEmailStatusDto | null | undefined;
    domainAccount: string;
}) {
    if (!hasValidDomainAccount) {
        return (
            <span className="text-xs text-[#8a8f94]" title="Nhập Tài khoản domain để đồng bộ email lên Identity">
                Cần tài khoản domain
            </span>
        );
    }
    if (!status) return <span className="text-xs text-[#8a8f94]">Đang kiểm tra...</span>;
    return status.userExists ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#5e3f3a]" title={`Tài khoản ${domainAccount} đã có trên Identity`}>
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Identity · {status.emails.length} email
        </span>
    ) : (
        <span
            className="inline-flex items-center gap-1.5 text-xs text-[#9a5b00]"
            title={`Tài khoản ${domainAccount} sẽ được tạo trên Identity khi đồng bộ`}
        >
            <span className="size-1.5 rounded-full bg-amber-500" />
            Chưa có trên Identity
        </span>
    );
}
