"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Search, Trash2, X } from "lucide-react";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import { SupplierApi } from "@/modules/pc-management/api/supplier.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import { DeviceGroupApi } from "@/modules/pc-management/api/device-group.api";
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import type { IpAddressDto } from "@/modules/pc-management/types/ip.dto";
import type { DeviceEmailInputDto, DeviceGetDto, DeviceIpAddressDto } from "@/modules/pc-management/types/device.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export interface DeviceFormValues {
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    groupId: number | null;
    departmentId: number | null;
    manager: string;
    emails: DeviceEmailInputDto[];
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string;
    serialNumber: string | null;
    isUseUsb: boolean;
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
    { value: 0, label: "Chờ sử dụng" },
    { value: 1, label: "Đang sử dụng" },
    { value: 2, label: "Chờ thanh lý" },
    { value: 3, label: "Đã thanh lý" },
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
    emails: [],
    purchaseDate: "",
    depreciationMonths: 36,
    isOutsourced: false,
    status: 0,
    note: "",
    serialNumber: "",
    isUseUsb: false,
    ipAddressIds: [],
};

function toDateInputValue(value: string | null | undefined) {
    if (!value) return "";
    return value.slice(0, 10);
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

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

    useEffect(() => {
        DeviceTypeApi.getAllDeviceTypes().then((data) => setDeviceTypes(data)).catch((err) => console.error(err));
        SupplierApi.getAllSuppliers().then((data) => setSuppliers(data)).catch((err) => console.error(err));
        BranchApi.getAllBranches().then((data) => setBranches(data)).catch((err) => console.error(err));
        DeviceDepartmentApi.getAllDeviceDepartments().then((data) => setDeviceDepartments(data)).catch((err) => console.error(err));
    }, []);

    // Nhóm cascading theo Bộ phận đã chọn (docs/asset-api-fe.md §2.1) — chưa chọn Bộ phận thì
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
        setIpDropdownOpen(false);
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
                      emails: current.emails.map((item) => ({ email: item.email, note: item.note })),
                      purchaseDate: toDateInputValue(current.purchaseDate),
                      depreciationMonths: current.depreciationMonths,
                      isOutsourced: current.isOutsourced,
                      status: current.status,
                      note: current.note ?? "",
                      serialNumber: current.serialNumber ?? "",
                      isUseUsb: current.isUseUsb,
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

    const handleAddEmail = () => {
        setValues((current) => ({ ...current, emails: [...current.emails, { email: "", note: null }] }));
    };

    const handleRemoveEmail = (index: number) => {
        setValues((current) => ({ ...current, emails: current.emails.filter((_, itemIndex) => itemIndex !== index) }));
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
            emails: trimmedEmails,
            note: values.note.trim(),
            serialNumber: values.serialNumber?.trim() ? values.serialNumber : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-form-title"
                className="z-60 mx-4 w-full max-w-4xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="device-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm thiết bị" : "Cập nhật thiết bị"}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>Mã thiết bị</span>
                            <input
                                value={values.deviceCode}
                                onChange={(event) => handleChange("deviceCode", event.target.value)}
                                placeholder="Nhập mã thiết bị..."
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Tên thiết bị</span>
                            <input
                                value={values.deviceName}
                                onChange={(event) => handleChange("deviceName", event.target.value)}
                                placeholder="Nhập tên thiết bị..."
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Loại thiết bị</span>
                            <SearchableSelect
                                options={deviceTypes.map((type) => ({ value: type.id, label: type.typeName, searchText: type.typeName.toLowerCase() }))}
                                value={values.deviceTypeId || ""}
                                onChange={(v) => handleChange("deviceTypeId", v === "" ? 0 : v)}
                                placeholder="Chọn loại thiết bị..."
                                disabled={loading}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhà cung cấp</span>
                            <SearchableSelect
                                options={suppliers.map((s) => ({ value: s.id, label: s.supplierName, searchText: s.supplierName.toLowerCase() }))}
                                value={values.supplierId || ""}
                                onChange={(v) => handleChange("supplierId", v === "" ? 0 : v)}
                                placeholder="Chọn nhà cung cấp..."
                                disabled={loading}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Chi nhánh</span>
                            <SearchableSelect
                                options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                                value={values.branchId || ""}
                                onChange={(v) => handleChange("branchId", v === "" ? 0 : v)}
                                placeholder="Chọn chi nhánh..."
                                disabled={loading}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Bộ phận</span>
                            <SearchableSelect
                                options={deviceDepartments.map((d) => ({ value: d.id, label: d.departmentName, searchText: d.departmentName.toLowerCase() }))}
                                value={values.departmentId ?? ""}
                                onChange={(v) => {
                                    // Đổi Bộ phận thì phải xoá lựa chọn Nhóm hiện tại — Nhóm thuộc Bộ phận cũ
                                    // gần như chắc chắn không hợp lệ với Bộ phận mới (docs/asset-api-fe.md §2.1).
                                    setValues((current) => ({ ...current, departmentId: v === "" ? null : v, groupId: null }));
                                }}
                                placeholder="Không gán bộ phận"
                                disabled={loading}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhóm</span>
                            <SearchableSelect
                                options={deviceGroups.map((g) => ({ value: g.id, label: g.groupName, searchText: g.groupName.toLowerCase() }))}
                                value={values.groupId ?? ""}
                                onChange={(v) => handleChange("groupId", v === "" ? null : v)}
                                placeholder={values.departmentId ? "Không gán nhóm" : "Chọn Bộ phận trước..."}
                                disabled={loading || !values.departmentId}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Người quản lý</span>
                            <input
                                value={values.manager}
                                onChange={(event) => handleChange("manager", event.target.value)}
                                placeholder="Chưa xác định (tuỳ chọn)..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Số Serial</span>
                            <input
                                value={values.serialNumber ?? ""}
                                onChange={(event) => handleChange("serialNumber", event.target.value)}
                                placeholder="Nhập số serial (tuỳ chọn)..."
                                disabled={loading}
                                maxLength={100}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Ngày mua</span>
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
                            <span className={fieldLabelClassName}>Thời gian khấu hao (tháng)</span>
                            <input
                                type="number"
                                min={1}
                                max={600}
                                value={values.depreciationMonths}
                                onChange={(event) => handleChange("depreciationMonths", Number(event.target.value))}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Trạng thái</span>
                            <select
                                value={values.status}
                                onChange={(event) => handleStatusChange(Number(event.target.value))}
                                disabled={loading}
                                className={fieldClassName}
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-2 pt-6">
                            <input
                                type="checkbox"
                                checked={values.isOutsourced}
                                onChange={(event) => handleChange("isOutsourced", event.target.checked)}
                                disabled={loading}
                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                            />
                            <span className="text-sm text-[#191c1e]">Thiết bị thuê ngoài</span>
                        </label>

                        <label className="flex items-center gap-2 pt-6">
                            <input
                                type="checkbox"
                                checked={values.isUseUsb}
                                onChange={(event) => handleChange("isUseUsb", event.target.checked)}
                                disabled={loading}
                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                            />
                            <span className="text-sm text-[#191c1e]">Sử dụng USB</span>
                        </label>
                    </div>

                    <div className="block" ref={ipPickerRef}>
                        <span className={fieldLabelClassName}>Địa chỉ IP</span>
                        {isLiquidationStatus ? (
                            <p className="text-xs text-[#8a8f94]">
                                Thiết bị Chờ thanh lý/Đã thanh lý không giữ địa chỉ IP — hệ thống tự gỡ để cấp cho thiết bị khác.
                            </p>
                        ) : selectedIps.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {selectedIps.map((ip) => (
                                    <span
                                        key={ip.id}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#191c1e]"
                                    >
                                        {ip.ipAddress}
                                        <button
                                            type="button"
                                            onClick={() => !loading && handleRemoveIp(ip.id)}
                                            disabled={loading}
                                            className="text-[#5e3f3a] transition hover:text-[#e3000f] disabled:cursor-not-allowed"
                                            aria-label={`Gỡ IP ${ip.ipAddress}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            {!isLiquidationStatus && (
                                <button
                                    type="button"
                                    onClick={() => !loading && setIpDropdownOpen((open) => !open)}
                                    disabled={loading}
                                    className={`${fieldClassName} flex items-center justify-between text-left`}
                                >
                                    <span className="text-[#9aa0a6]">+ Thêm địa chỉ IP...</span>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
                                </button>
                            )}

                            {ipDropdownOpen && !isLiquidationStatus && (
                                <div className="absolute left-0 right-0 z-70 mt-1 rounded-lg border border-[#e0e3e5] bg-white shadow-xl">
                                    <div className="border-b border-[#e0e3e5] p-2">
                                        <div className="flex items-center gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-2.5">
                                            <Search className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
                                            <input
                                                value={ipSearch}
                                                onChange={(event) => setIpSearch(event.target.value)}
                                                placeholder="Tìm địa chỉ IP..."
                                                autoFocus
                                                className="h-9 w-full bg-transparent text-sm text-[#191c1e] outline-none"
                                            />
                                        </div>
                                    </div>
                                    <ul className="max-h-52 overflow-y-auto py-1 text-sm text-[#191c1e]">
                                        {availableIps
                                            .filter((ip) => !values.ipAddressIds.includes(ip.id))
                                            .map((ip) => (
                                                <li key={ip.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddIp({ id: ip.id, ipAddress: ip.ipAddress })}
                                                        className="w-full cursor-pointer px-3 py-2 text-left transition hover:bg-[#f2f4f6]"
                                                    >
                                                        {ip.ipAddress}
                                                    </button>
                                                </li>
                                            ))}
                                        {availableIps.filter((ip) => !values.ipAddressIds.includes(ip.id)).length === 0 && (
                                            <li className="px-3 py-2 text-[#5e3f3a]">
                                                {(() => {
                                                    const trimmedSearch = ipSearch.trim();
                                                    const isFullIpFormat = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmedSearch);
                                                    const alreadyAddedToThisDevice = selectedIps.some((ip) => ip.ipAddress === trimmedSearch);
                                                    if (alreadyAddedToThisDevice) {
                                                        return `IP ${trimmedSearch} đã được thêm vào thiết bị này rồi.`;
                                                    }
                                                    // `/available` chỉ trả IP status "Chưa sử dụng" (docs/asset-api-fe.md §4.2) — gõ đủ 4
                                                    // octet mà không ra kết quả nghĩa là IP đó đang gán cho thiết bị khác/dùng ngoài hoặc
                                                    // không tồn tại trong hệ thống, KHÔNG PHẢI lỗi tìm kiếm — làm rõ để tránh hiểu lầm
                                                    // "không gán được IP".
                                                    if (isFullIpFormat) {
                                                        return `IP ${trimmedSearch} không có trong danh sách IP trống — có thể IP này đang được sử dụng cho thiết bị khác hoặc không tồn tại trong hệ thống.`;
                                                    }
                                                    return "Không tìm thấy IP trống";
                                                })()}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="block">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className={fieldLabelClassName}>Email</span>
                            <button
                                type="button"
                                onClick={handleAddEmail}
                                disabled={loading}
                                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#e3000f] transition hover:text-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Thêm email
                            </button>
                        </div>
                        <div className="space-y-2">
                            {values.emails.map((item, index) => (
                                <div key={index} className="flex items-start gap-2">
                                    <input
                                        type="email"
                                        value={item.email}
                                        onChange={(event) => handleEmailChange(index, "email", event.target.value)}
                                        placeholder="Nhập email..."
                                        disabled={loading}
                                        className={`${fieldClassName} flex-1`}
                                    />
                                    <input
                                        value={item.note ?? ""}
                                        onChange={(event) => handleEmailChange(index, "note", event.target.value)}
                                        placeholder="Ghi chú (tuỳ chọn)..."
                                        disabled={loading}
                                        className={`${fieldClassName} flex-1`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEmail(index)}
                                        disabled={loading}
                                        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="Xoá email"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Ghi chú</span>
                        <textarea
                            value={values.note}
                            onChange={(event) => handleChange("note", event.target.value)}
                            placeholder="Nhập ghi chú..."
                            disabled={loading}
                            required
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
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
    );
}
