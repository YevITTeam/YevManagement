"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import { SupplierApi } from "@/modules/pc-management/api/supplier.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { IpAddressDto } from "@/modules/pc-management/types/ip.dto";
import type { DeviceGetDto } from "@/modules/pc-management/types/device.dto";

export interface DeviceFormValues {
    deviceCode: string;
    deviceName: string;
    deviceTypeId: number;
    supplierId: number;
    branchId: number;
    manager: string;
    email: string;
    purchaseDate: string;
    depreciationMonths: number;
    isOutsourced: boolean;
    status: number;
    note: string | null;
    serialNumber: string | null;
    isUseUsb: boolean;
    ipAddressId: number | null;
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
    manager: "",
    email: "",
    purchaseDate: "",
    depreciationMonths: 36,
    isOutsourced: false,
    status: 0,
    note: "",
    serialNumber: "",
    isUseUsb: false,
    ipAddressId: null,
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
    const [availableIps, setAvailableIps] = useState<IpAddressDto[]>([]);
    const [ipSearch, setIpSearch] = useState("");
    const [ipDropdownOpen, setIpDropdownOpen] = useState(false);
    const [selectedIp, setSelectedIp] = useState<{ id: number; ipAddress: string } | null>(null);
    const ipPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        DeviceTypeApi.getAllDeviceTypes().then((data) => setDeviceTypes(data)).catch((err) => console.error(err));
        SupplierApi.getAllSuppliers().then((data) => setSuppliers(data)).catch((err) => console.error(err));
        BranchApi.getAllBranches().then((data) => setBranches(data)).catch((err) => console.error(err));
    }, []);

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
        setSelectedIp(
            initial?.ipAddressId != null
                ? { id: initial.ipAddressId, ipAddress: initial.ipAddress ?? `#${initial.ipAddressId}` }
                : null
        );
        setValues(
            initial
                ? {
                      deviceCode: initial.deviceCode,
                      deviceName: initial.deviceName,
                      deviceTypeId: initial.deviceTypeId,
                      supplierId: initial.supplierId,
                      branchId: initial.branchId,
                      manager: initial.manager,
                      email: initial.email,
                      purchaseDate: toDateInputValue(initial.purchaseDate),
                      depreciationMonths: initial.depreciationMonths,
                      isOutsourced: initial.isOutsourced,
                      status: initial.status,
                      note: initial.note ?? "",
                      serialNumber: initial.serialNumber ?? "",
                      isUseUsb: initial.isUseUsb,
                      ipAddressId: initial.ipAddressId,
                  }
                : emptyValues
        );
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleSelectIp = (ip: { id: number; ipAddress: string } | null) => {
        setSelectedIp(ip);
        handleChange("ipAddressId", ip ? ip.id : null);
        setIpDropdownOpen(false);
        setIpSearch("");
    };

    const handleChange = <K extends keyof DeviceFormValues>(field: K, value: DeviceFormValues[K]) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (
            !values.deviceCode.trim() ||
            !values.deviceName.trim() ||
            !values.deviceTypeId ||
            !values.supplierId ||
            !values.branchId ||
            !values.manager.trim() ||
            !values.email.trim() ||
            !values.purchaseDate
        ) {
            return;
        }
        onSubmit({
            ...values,
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
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
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
                    <div className="grid gap-4 md:grid-cols-2">
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

                        <div className="block" ref={ipPickerRef}>
                            <span className={fieldLabelClassName}>Địa chỉ IP</span>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => !loading && setIpDropdownOpen((open) => !open)}
                                    disabled={loading}
                                    className={`${fieldClassName} flex items-center justify-between text-left`}
                                >
                                    <span className={selectedIp ? "text-[#191c1e]" : "text-[#9aa0a6]"}>
                                        {selectedIp ? selectedIp.ipAddress : "Không gán IP"}
                                    </span>
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
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectIp(null)}
                                                    className="w-full cursor-pointer px-3 py-2 text-left text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                                >
                                                    Không gán IP
                                                </button>
                                            </li>
                                            {availableIps.map((ip) => (
                                                <li key={ip.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectIp({ id: ip.id, ipAddress: ip.ipAddress })}
                                                        className={`w-full cursor-pointer px-3 py-2 text-left transition hover:bg-[#f2f4f6] ${
                                                            values.ipAddressId === ip.id ? "bg-[#ffe0e3] font-semibold text-[#e3000f]" : ""
                                                        }`}
                                                    >
                                                        {ip.ipAddress}
                                                    </button>
                                                </li>
                                            ))}
                                            {availableIps.length === 0 && (
                                                <li className="px-3 py-2 text-[#9aa0a6]">Không tìm thấy IP trống</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

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
                            <span className={fieldLabelClassName}>Email</span>
                            <input
                                type="email"
                                value={values.email}
                                onChange={(event) => handleChange("email", event.target.value)}
                                placeholder="Nhập email..."
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
