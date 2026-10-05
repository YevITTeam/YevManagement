"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, ChevronDown, ChevronUp, Filter, Layers, Mail, MapPin, QrCode, Search, Tag, Truck, User, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import { DeviceGroupApi } from "@/modules/pc-management/api/device-group.api";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";

export interface DeviceFilters {
    deviceCode: string;
    manager: string;
    ipAddress: string;
    email: string;
    supplierName: string;
    purchaseDate: string;
    branch: string;
    deviceType: string;
    status: string;
    expiryDate: string;
    serialNumber: string;
    // "" = tất cả, "true"/"false" — dùng string vì DeviceFilters là bộ lọc kiểu string đồng nhất.
    isUseUsb: string;
    // "" = tất cả, "true"/"false" — lọc theo cờ "Cần kiểm tra hằng ngày (QR)", dùng để gom nhanh danh
    // sách in QR cho phòng server (asset-module.md §1.19/§1.21).
    requiresDailyCheck: string;
    // "" = tất cả, ngược lại là Id (dạng string) của Nhóm/Bộ phận — lọc chính xác qua API (docs/asset-api-fe.md §5.2).
    groupId: string;
    departmentId: string;
}

export interface DeviceFilterBarProps {
    onFilter: (filters: DeviceFilters) => void;
}

const defaultFilters: DeviceFilters = {
    deviceCode: "",
    manager: "",
    ipAddress: "",
    email: "",
    supplierName: "",
    purchaseDate: "",
    branch: "",
    deviceType: "",
    status: "",
    expiryDate: "",
    serialNumber: "",
    isUseUsb: "",
    requiresDailyCheck: "",
    groupId: "",
    departmentId: "",
};

const filterLabels: Record<keyof DeviceFilters, string> = {
    deviceCode: "Mã thiết bị",
    manager: "Người quản lý",
    ipAddress: "IP",
    email: "Email",
    supplierName: "Nhà cung cấp",
    purchaseDate: "Ngày mua",
    branch: "Chi nhánh",
    deviceType: "Loại thiết bị",
    status: "Trạng thái",
    expiryDate: "Hạn sử dụng",
    serialNumber: "Số Serial",
    isUseUsb: "Cho phép dùng USB",
    requiresDailyCheck: "Kiểm tra hằng ngày (QR)",
    groupId: "Nhóm",
    departmentId: "Bộ phận",
};

// These fields are sent straight to the Device/grid-list API as query params.
const advancedFields: (keyof DeviceFilters)[] = [
    "supplierName",
    "email",
    "purchaseDate",
    "expiryDate",
    "serialNumber",
    "isUseUsb",
    "requiresDailyCheck",
    "groupId",
    "manager",
    "departmentId",
];

const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm! text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const fieldWithIconClassName = `${fieldClassName} pl-8`;

const fieldLabelClassName = "mb-1 flex items-center gap-1 text-xs font-semibold text-[#5e3f3a]";

// Nhãn hiển thị cho chip "Đang lọc" của field status — value thật gửi lên API là số (0-3) hoặc
// sentinel "outsourced" (lọc theo IsOutsourced), không phải chuỗi tiếng Việt.
const statusChipLabels: Record<string, string> = {
    "0": "Chưa sử dụng",
    "1": "Đang sử dụng",
    "2": "Chờ thanh lý",
    "3": "Đã thanh lý",
    outsourced: "Thuê ngoài",
};

export default function DeviceFilterBar({ onFilter }: DeviceFilterBarProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [filters, setFilters] = useState<DeviceFilters>(defaultFilters);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDto[]>([]);
    const [deviceGroups, setDeviceGroups] = useState<DeviceGroupDto[]>([]);
    const [deviceDepartments, setDeviceDepartments] = useState<DeviceDepartmentDto[]>([]);
    const isFirstRender = useRef(true);
    const lastSubmitted = useRef<string>(JSON.stringify(defaultFilters));

    useEffect(() => {
        let isCancelled = false;

        BranchApi.getAllBranches()
            .then((data) => {
                if (!isCancelled) setBranches(data);
            })
            .catch((err) => console.error(err));

        DeviceTypeApi.getAllDeviceTypes()
            .then((data) => {
                if (!isCancelled) setDeviceTypes(data);
            })
            .catch((err) => console.error(err));

        DeviceDepartmentApi.getAllDeviceDepartments()
            .then((data) => {
                if (!isCancelled) setDeviceDepartments(data);
            })
            .catch((err) => console.error(err));

        return () => {
            isCancelled = true;
        };
    }, []);

    // Group list follows the selected department; with no department selected every group is listed.
    useEffect(() => {
        let isCancelled = false;
        const departmentId = filters.departmentId === "" ? undefined : Number(filters.departmentId);

        DeviceGroupApi.getAllDeviceGroups(departmentId)
            .then((data) => {
                if (!isCancelled) setDeviceGroups(data);
            })
            .catch((err) => console.error(err));

        return () => {
            isCancelled = true;
        };
    }, [filters.departmentId]);

    // Tự động tìm kiếm sau khi người dùng ngừng gõ/thay đổi bộ lọc (debounce), không cần nút "Lọc dữ liệu".
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timeoutId = setTimeout(() => {
            const serialized = JSON.stringify(filters);
            if (serialized === lastSubmitted.current) return;
            lastSubmitted.current = serialized;
            onFilter(filters);
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [filters, onFilter]);

    const activeEntries = useMemo(
        () => (Object.entries(filters) as [keyof DeviceFilters, string][]).filter(([, value]) => value !== ""),
        [filters]
    );
    const advancedActiveCount = useMemo(
        () => activeEntries.filter(([field]) => advancedFields.includes(field)).length,
        [activeEntries]
    );

    const handleChange = (field: keyof DeviceFilters, value: string) => {
        setFilters((current) => ({
            ...current,
            [field]: value,
            // A group belongs to exactly one department, so a previously picked group is cleared when the department changes.
            ...(field === "departmentId" ? { groupId: "" } : {}),
        }));
    };

    const handleReset = () => {
        lastSubmitted.current = JSON.stringify(defaultFilters);
        setFilters(defaultFilters);
        onFilter(defaultFilters);
    };

    const handleRemoveChip = (field: keyof DeviceFilters) => {
        const next = { ...filters, [field]: "" };
        lastSubmitted.current = JSON.stringify(next);
        setFilters(next);
        onFilter(next);
    };

    return (
        <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
            <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2 [&>*]:w-full sm:[&>*]:w-44">
                    <IconInput
                        icon={Search}
                        value={filters.deviceCode}
                        onChange={(value) => handleChange("deviceCode", value)}
                        placeholder="Mã thiết bị..."
                        className="sm:w-56!"
                    />
                    <IconSelect
                        icon={Building2}
                        options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                        value={filters.branch}
                        onChange={(value) => handleChange("branch", value)}
                        placeholder="Chi nhánh"
                    />
                    <IconSelect
                        icon={Tag}
                        options={deviceTypes.map((dt) => ({ value: dt.id, label: dt.typeName, searchText: dt.typeName.toLowerCase() }))}
                        value={filters.deviceType}
                        onChange={(value) => handleChange("deviceType", value)}
                        placeholder="Loại thiết bị"
                    />
                    <IconInput
                        icon={MapPin}
                        value={filters.ipAddress}
                        onChange={(value) => handleChange("ipAddress", value)}
                        placeholder="Địa chỉ IP"
                    />
                    <NativeSelect
                        value={filters.status}
                        onChange={(value) => handleChange("status", value)}
                        options={[
                            { value: "", label: "Tất cả trạng thái" },
                            { value: "0", label: "Chưa sử dụng", dotClassName: "bg-[#94a3b8]" },
                            { value: "1", label: "Đang sử dụng", dotClassName: "bg-[#16a34a]" },
                            { value: "2", label: "Chờ thanh lý", dotClassName: "bg-[#f59e0b]" },
                            { value: "3", label: "Đã thanh lý", dotClassName: "bg-[#dc2626]" },
                            // Not a Device.Status value (only 0-3) — separate filter on IsOutsourced sharing this dropdown.
                            { value: "outsourced", label: "Thuê ngoài", dotClassName: "bg-[#2563eb]" },
                        ]}
                    />

                    <div className="flex items-center gap-2 sm:ml-auto! sm:w-auto!">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen((current) => !current)}
                            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f8fafc]"
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Lọc thêm
                            {advancedActiveCount > 0 && (
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e3000f] px-1 text-[11px] font-semibold text-white">
                                    {advancedActiveCount}
                                </span>
                            )}
                            {isAdvancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={activeEntries.length === 0}
                            title="Xóa bộ lọc"
                            aria-label="Xóa bộ lọc"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {isAdvancedOpen && (
                    <div className="grid gap-x-3 gap-y-2.5 border-t border-[#e0e3e5] pt-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <Field label="Người quản lý" icon={User}>
                            <IconInput icon={User} value={filters.manager} onChange={(value) => handleChange("manager", value)} placeholder="Tên người quản lý" />
                        </Field>
                        <Field label="Bộ phận" icon={Users}>
                            <IconSelect
                                icon={Users}
                                options={deviceDepartments.map((d) => ({ value: d.id, label: d.departmentName, searchText: d.departmentName.toLowerCase() }))}
                                value={filters.departmentId}
                                onChange={(value) => handleChange("departmentId", value)}
                                placeholder="Tất cả bộ phận"
                            />
                        </Field>
                        <Field label="Nhóm" icon={Layers}>
                            <IconSelect
                                icon={Layers}
                                options={deviceGroups.map((g) => ({ value: g.id, label: g.groupName, searchText: g.groupName.toLowerCase() }))}
                                value={filters.groupId}
                                onChange={(value) => handleChange("groupId", value)}
                                placeholder="Tất cả nhóm"
                            />
                        </Field>
                        <Field label="Nhà cung cấp" icon={Truck}>
                            <IconInput icon={Truck} value={filters.supplierName} onChange={(value) => handleChange("supplierName", value)} placeholder="Tên nhà cung cấp" />
                        </Field>
                        <Field label="Email" icon={Mail}>
                            <IconInput icon={Mail} value={filters.email} onChange={(value) => handleChange("email", value)} placeholder="Email" />
                        </Field>
                        <Field label="Số Serial" icon={Tag}>
                            <IconInput icon={Tag} value={filters.serialNumber} onChange={(value) => handleChange("serialNumber", value)} placeholder="Số Serial" />
                        </Field>
                        <Field label="Ngày mua" icon={Calendar}>
                            <input type="date" value={filters.purchaseDate} onChange={(event) => handleChange("purchaseDate", event.target.value)} className={fieldClassName} />
                        </Field>
                        <Field label="Hết hạn trước" icon={Calendar}>
                            <input type="date" value={filters.expiryDate} onChange={(event) => handleChange("expiryDate", event.target.value)} className={fieldClassName} />
                        </Field>

                        <Field label="Cho phép dùng USB">
                            <NativeSelect
                                value={filters.isUseUsb}
                                onChange={(value) => handleChange("isUseUsb", value)}
                                options={[
                                    { value: "", label: "Tất cả" },
                                    { value: "true", label: "Có" },
                                    { value: "false", label: "Không" },
                                ]}
                            />
                        </Field>
                        <Field label="Kiểm tra hằng ngày (QR)" icon={QrCode}>
                            <NativeSelect
                                value={filters.requiresDailyCheck}
                                onChange={(value) => handleChange("requiresDailyCheck", value)}
                                options={[
                                    { value: "", label: "Tất cả" },
                                    { value: "true", label: "Có — cần quét QR" },
                                    { value: "false", label: "Không" },
                                ]}
                            />
                        </Field>
                    </div>
                )}

                {activeEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-[#e0e3e5] pt-2">
                        <span className="text-xs font-semibold text-[#5e3f3a]">Đang lọc:</span>
                        {activeEntries.map(([field, value]) => (
                            <span
                                key={field}
                                className="flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs text-[#5e3f3a]"
                            >
                                <span className="font-semibold text-[#191c1e]">{filterLabels[field]}:</span>
                                {field === "isUseUsb" || field === "requiresDailyCheck"
                                    ? value === "true"
                                        ? "Có"
                                        : "Không"
                                    : field === "groupId"
                                      ? (deviceGroups.find((group) => String(group.id) === value)?.groupName ?? value)
                                      : field === "departmentId"
                                        ? (deviceDepartments.find((department) => String(department.id) === value)?.departmentName ?? value)
                                        : field === "branch"
                                          ? (branches.find((branch) => String(branch.id) === value)?.branchName ?? value)
                                          : field === "deviceType"
                                            ? (deviceTypes.find((deviceType) => String(deviceType.id) === value)?.typeName ?? value)
                                            : field === "status"
                                              ? (statusChipLabels[value] ?? value)
                                              : value}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveChip(field)}
                                    className="text-[#5e3f3a] transition hover:text-[#e3000f]"
                                    aria-label={`Xóa bộ lọc ${filterLabels[field]}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

// Small presentational helpers so every filter cell looks identical (height, font, icon, chevron).

function Field({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: React.ReactNode }) {
    return (
        <label className="block min-w-0">
            <span className={fieldLabelClassName}>
                {Icon && <Icon className="h-3 w-3" />}
                {label}
            </span>
            {children}
        </label>
    );
}

function IconInput({
    icon: Icon,
    value,
    onChange,
    placeholder,
    className = "",
}: {
    icon: LucideIcon;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                title={placeholder}
                className={fieldWithIconClassName}
            />
        </div>
    );
}

function IconSelect({
    icon: Icon,
    options,
    value,
    onChange,
    placeholder,
}: {
    icon: LucideIcon;
    options: { value: number; label: string; searchText: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <div className="relative">
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
            <SearchableSelect
                options={options}
                value={value === "" ? "" : Number(value)}
                onChange={(v) => onChange(v === "" ? "" : String(v))}
                placeholder={placeholder}
                triggerClassName={fieldWithIconClassName}
            />
        </div>
    );
}

function NativeSelect({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string; dotClassName?: string }[];
}) {
    return <StyledSelect value={value} onChange={onChange} triggerClassName={`${fieldClassName} pr-8`} options={options} />;
}
