"use client";

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
    "deviceType",
    "status",
    "email",
    "purchaseDate",
    "expiryDate",
    "serialNumber",
    "isUseUsb",
    "requiresDailyCheck",
    "groupId",
    "departmentId",
];

const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const fieldWithIconClassName = `${fieldClassName} pl-9`;

const fieldLabelClassName = "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

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

        DeviceGroupApi.getAllDeviceGroups()
            .then((data) => {
                if (!isCancelled) setDeviceGroups(data);
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
        setFilters((current) => ({ ...current, [field]: value }));
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
        <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap">
                        <label className="min-w-[220px] flex-1">
                            <span className={fieldLabelClassName}>
                                <Search className="h-3.5 w-3.5" />
                                Mã thiết bị
                            </span>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.deviceCode}
                                    onChange={(event) => handleChange("deviceCode", event.target.value)}
                                    placeholder="Nhập mã thiết bị..."
                                    className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-[#f8fafc] pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:bg-white focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </div>
                        </label>

                        <label className="min-w-[170px] flex-1">
                            <span className={fieldLabelClassName}>
                                <Building2 className="h-3.5 w-3.5" />
                                Chi nhánh
                            </span>
                            <div className="relative">
                                <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <SearchableSelect
                                    options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                                    value={filters.branch === "" ? "" : Number(filters.branch)}
                                    onChange={(v) => handleChange("branch", v === "" ? "" : String(v))}
                                    placeholder="Tất cả chi nhánh"
                                    triggerClassName={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label className="min-w-[170px] flex-1">
                            <span className={fieldLabelClassName}>
                                <User className="h-3.5 w-3.5" />
                                Người quản lý
                            </span>
                            <div className="relative">
                                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.manager}
                                    onChange={(event) => handleChange("manager", event.target.value)}
                                    placeholder="Nhập tên người quản lý..."
                                    className={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label className="min-w-[180px] flex-1">
                            <span className={fieldLabelClassName}>
                                <MapPin className="h-3.5 w-3.5" />
                                Địa chỉ IP
                            </span>
                            <div className="relative">
                                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.ipAddress}
                                    onChange={(event) => handleChange("ipAddress", event.target.value)}
                                    placeholder="Nhập địa chỉ IP..."
                                    className={fieldWithIconClassName}
                                />
                            </div>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen((current) => !current)}
                            className="flex h-10 items-center gap-2 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f8fafc]"
                        >
                            <Filter className="h-4 w-4" />
                            Bộ lọc nâng cao
                            {advancedActiveCount > 0 && (
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e3000f] px-1 text-[11px] font-semibold text-white">
                                    {advancedActiveCount}
                                </span>
                            )}
                            {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="cursor-pointer flex h-10 items-center gap-2 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f8fafc]"
                        >
                            <X className="h-4 w-4" />
                            Xóa bộ lọc
                        </button>
                    </div>
                </div>

                {isAdvancedOpen && (
                    <div className="grid gap-3 border-t border-[#e0e3e5] pt-4 md:grid-cols-2 xl:grid-cols-3">
                        <label>
                            <span className={fieldLabelClassName}>
                                <Truck className="h-3.5 w-3.5" />
                                Nhà cung cấp
                            </span>
                            <div className="relative">
                                <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.supplierName}
                                    onChange={(event) => handleChange("supplierName", event.target.value)}
                                    placeholder="Nhập tên nhà cung cấp..."
                                    className={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Tag className="h-3.5 w-3.5" />
                                Loại thiết bị
                            </span>
                            <div className="relative">
                                <Tag className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <SearchableSelect
                                    options={deviceTypes.map((dt) => ({ value: dt.id, label: dt.typeName, searchText: dt.typeName.toLowerCase() }))}
                                    value={filters.deviceType === "" ? "" : Number(filters.deviceType)}
                                    onChange={(v) => handleChange("deviceType", v === "" ? "" : String(v))}
                                    placeholder="Tất cả loại"
                                    triggerClassName={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>Trạng thái</span>
                            <select
                                value={filters.status}
                                onChange={(event) => handleChange("status", event.target.value)}
                                className={fieldClassName}
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="0">Chưa sử dụng</option>
                                <option value="1">Đang sử dụng</option>
                                <option value="2">Chờ thanh lý</option>
                                <option value="3">Đã thanh lý</option>
                                {/* Không phải 1 giá trị của Device.Status (chỉ có 0-3) — đây là filter riêng
                                    trên field IsOutsourced, dùng chung dropdown cho gọn UI. */}
                                <option value="outsourced">Thuê ngoài</option>
                            </select>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Mail className="h-3.5 w-3.5" />
                                Email
                            </span>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.email}
                                    onChange={(event) => handleChange("email", event.target.value)}
                                    placeholder="Nhập email..."
                                    className={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Calendar className="h-3.5 w-3.5" />
                                Ngày mua
                            </span>
                            <input
                                type="date"
                                value={filters.purchaseDate}
                                onChange={(event) => handleChange("purchaseDate", event.target.value)}
                                className={fieldClassName}
                            />
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Calendar className="h-3.5 w-3.5" />
                                Hết hạn trước
                            </span>
                            <input
                                type="date"
                                value={filters.expiryDate}
                                onChange={(event) => handleChange("expiryDate", event.target.value)}
                                className={fieldClassName}
                            />
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Tag className="h-3.5 w-3.5" />
                                Số Serial
                            </span>
                            <div className="relative">
                                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.serialNumber}
                                    onChange={(event) => handleChange("serialNumber", event.target.value)}
                                    placeholder="Nhập số Serial..."
                                    className={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>Cho phép dùng USB</span>
                            <select
                                value={filters.isUseUsb}
                                onChange={(event) => handleChange("isUseUsb", event.target.value)}
                                className={fieldClassName}
                            >
                                <option value="">Tất cả</option>
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <QrCode className="h-3.5 w-3.5" />
                                Kiểm tra hằng ngày (QR)
                            </span>
                            <select
                                value={filters.requiresDailyCheck}
                                onChange={(event) => handleChange("requiresDailyCheck", event.target.value)}
                                className={fieldClassName}
                            >
                                <option value="">Tất cả</option>
                                <option value="true">Có — cần quét QR</option>
                                <option value="false">Không</option>
                            </select>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Layers className="h-3.5 w-3.5" />
                                Nhóm
                            </span>
                            <div className="relative">
                                <Layers className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <SearchableSelect
                                    options={deviceGroups.map((g) => ({ value: g.id, label: g.groupName, searchText: g.groupName.toLowerCase() }))}
                                    value={filters.groupId === "" ? "" : Number(filters.groupId)}
                                    onChange={(v) => handleChange("groupId", v === "" ? "" : String(v))}
                                    placeholder="Tất cả nhóm"
                                    triggerClassName={fieldWithIconClassName}
                                />
                            </div>
                        </label>

                        <label>
                            <span className={fieldLabelClassName}>
                                <Users className="h-3.5 w-3.5" />
                                Bộ phận
                            </span>
                            <div className="relative">
                                <Users className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <SearchableSelect
                                    options={deviceDepartments.map((d) => ({ value: d.id, label: d.departmentName, searchText: d.departmentName.toLowerCase() }))}
                                    value={filters.departmentId === "" ? "" : Number(filters.departmentId)}
                                    onChange={(v) => handleChange("departmentId", v === "" ? "" : String(v))}
                                    placeholder="Tất cả bộ phận"
                                    triggerClassName={fieldWithIconClassName}
                                />
                            </div>
                        </label>
                    </div>
                )}

                {activeEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e3e5] pt-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Đang lọc:</span>
                        {activeEntries.map(([field, value]) => (
                            <span
                                key={field}
                                className="flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs text-[#5e3f3a]"
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
