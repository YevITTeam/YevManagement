"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
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
    note: string | null;
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
    emails: [{ email: "", note: null }],
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
    // danh sách Nhóm rỗng và dropdown Nhóm bị disable.
    useEffect(() => {
        if (!isOpen || !values.departmentId) {
            setDeviceGroups([]);
            return;
        }
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

    useEffect(() => {
        if (!isOpen) return;
        setIpSearch("");
        setIpDropdownOpen(false);
        setSelectedIps(initial?.ipAddresses ?? []);
        setValues(
            initial
                ? {
                      deviceCode: initial.deviceCode,
                      deviceName: initial.deviceName,
                      deviceTypeId: initial.deviceTypeId,
                      supplierId: initial.supplierId,
                      branchId: initial.branchId,
                      groupId: initial.groupId,
                      departmentId: initial.departmentId,
                      manager: initial.manager,
                      emails:
                          initial.emails.length > 0
                              ? initial.emails.map((item) => ({ email: item.email, note: item.note }))
                              : [{ email: "", note: null }],
                      purchaseDate: toDateInputValue(initial.purchaseDate),
                      depreciationMonths: initial.depreciationMonths,
                      isOutsourced: initial.isOutsourced,
                      status: initial.status,
                      note: initial.note ?? "",
                      serialNumber: initial.serialNumber ?? "",
                      isUseUsb: initial.isUseUsb,
                      ipAddressIds: initial.ipAddresses.map((ip) => ip.id),
                  }
                : emptyValues
        );
    }, [isOpen, initial]);

    if (!isOpen) return null;

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
            !values.manager.trim() ||
            !values.purchaseDate ||
            trimmedEmails.length === 0
        ) {
            return;
        }
        onSubmit({
            ...values,
            emails: trimmedEmails,
            note: values.note?.trim() ? values.note : null,
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
                        ✕
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
                            <select
                                value={values.deviceTypeId || ""}
                                onChange={(event) => handleChange("deviceTypeId", Number(event.target.value))}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn loại thiết bị...
                                </option>
                                {deviceTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.typeName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhà cung cấp</span>
                            <select
                                value={values.supplierId || ""}
                                onChange={(event) => handleChange("supplierId", Number(event.target.value))}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn nhà cung cấp...
                                </option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.supplierName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Chi nhánh</span>
                            <select
                                value={values.branchId || ""}
                                onChange={(event) => handleChange("branchId", Number(event.target.value))}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn chi nhánh...
                                </option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.branchName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Bộ phận</span>
                            <select
                                value={values.departmentId ?? ""}
                                onChange={(event) => {
                                    const newDepartmentId = event.target.value ? Number(event.target.value) : null;
                                    // Đổi Bộ phận thì phải xoá lựa chọn Nhóm hiện tại — Nhóm thuộc Bộ phận cũ
                                    // gần như chắc chắn không hợp lệ với Bộ phận mới (docs/asset-api-fe.md §2.1).
                                    setValues((current) => ({ ...current, departmentId: newDepartmentId, groupId: null }));
                                }}
                                disabled={loading}
                                className={fieldClassName}
                            >
                                <option value="">Không gán bộ phận</option>
                                {deviceDepartments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.departmentName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhóm</span>
                            <select
                                value={values.groupId ?? ""}
                                onChange={(event) => handleChange("groupId", event.target.value ? Number(event.target.value) : null)}
                                disabled={loading || !values.departmentId}
                                className={fieldClassName}
                            >
                                <option value="">{values.departmentId ? "Không gán nhóm" : "Chọn Bộ phận trước..."}</option>
                                {deviceGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.groupName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Người quản lý</span>
                            <input
                                value={values.manager}
                                onChange={(event) => handleChange("manager", event.target.value)}
                                placeholder="Nhập tên người quản lý..."
                                disabled={loading}
                                required
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
                                onChange={(event) => handleChange("status", Number(event.target.value))}
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
                        {selectedIps.length > 0 && (
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
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => !loading && setIpDropdownOpen((open) => !open)}
                                disabled={loading}
                                className={`${fieldClassName} flex items-center justify-between text-left`}
                            >
                                <span className="text-[#9aa0a6]">+ Thêm địa chỉ IP...</span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-[#5e3f3a]" />
                            </button>

                            {ipDropdownOpen && (
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
                                            <li className="px-3 py-2 text-[#9aa0a6]">Không tìm thấy IP trống</li>
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
                                        required={values.emails.length === 1}
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
                                        disabled={loading || values.emails.length === 1}
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
                            value={values.note ?? ""}
                            onChange={(event) => handleChange("note", event.target.value)}
                            placeholder="Ghi chú tuỳ chọn..."
                            disabled={loading}
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
