"use client";

import { Building2, Calendar, ChevronDown, ChevronUp, Filter, MapPin, Search, Tag, Truck, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";

export interface DeviceFilters {
    deviceCode: string;
    manager: string;
    ipAddress: string;
    supplierName: string;
    purchaseDate: string;
    branch: string;
    deviceType: string;
    status: string;
    expiryDate: string;
}

export interface DeviceFilterBarProps {
    onFilter: (filters: DeviceFilters) => void;
}

const defaultFilters: DeviceFilters = {
    deviceCode: "",
    manager: "",
    ipAddress: "",
    supplierName: "",
    purchaseDate: "",
    branch: "",
    deviceType: "",
    status: "",
    expiryDate: "",
};

const filterLabels: Record<keyof DeviceFilters, string> = {
    deviceCode: "Mã thiết bị",
    manager: "Người quản lý",
    ipAddress: "IP",
    supplierName: "Nhà cung cấp",
    purchaseDate: "Ngày mua",
    branch: "Chi nhánh",
    deviceType: "Loại thiết bị",
    status: "Trạng thái",
    expiryDate: "Hạn sử dụng",
};

// These fields are sent straight to the Device/grid-list API as query params.
const advancedFields: (keyof DeviceFilters)[] = ["supplierName", "manager", "ipAddress", "purchaseDate", "expiryDate"];

const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const fieldWithIconClassName = `${fieldClassName} pl-9`;

const fieldLabelClassName = "mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

export default function DeviceFilterBar({ onFilter }: DeviceFilterBarProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [filters, setFilters] = useState<DeviceFilters>(defaultFilters);
    const [branches, setBranches] = useState<BranchDto[]>([]);

    useEffect(() => {
        let isCancelled = false;

        BranchApi.getAllBranches()
            .then((data) => {
                if (!isCancelled) setBranches(data);
            })
            .catch((err) => console.error(err));

        return () => {
            isCancelled = true;
        };
    }, []);

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

    const handleSubmit = () => {
        onFilter(filters);
    };

    const handleReset = () => {
        setFilters(defaultFilters);
        onFilter(defaultFilters);
    };

    const handleRemoveChip = (field: keyof DeviceFilters) => {
        const next = { ...filters, [field]: "" };
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
                                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <select
                                    value={filters.branch}
                                    onChange={(event) => handleChange("branch", event.target.value)}
                                    className={fieldWithIconClassName}
                                >
                                    <option value="">Tất cả chi nhánh</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.branchName}>
                                            {branch.branchName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </label>

                        <label className="min-w-[170px] flex-1">
                            <span className={fieldLabelClassName}>
                                <Tag className="h-3.5 w-3.5" />
                                Loại thiết bị
                            </span>
                            <div className="relative">
                                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <select
                                    value={filters.deviceType}
                                    onChange={(event) => handleChange("deviceType", event.target.value)}
                                    className={fieldWithIconClassName}
                                >
                                    <option value="">Tất cả loại</option>
                                    <option value="Máy bàn">Máy bàn</option>
                                    <option value="Laptop">Laptop</option>
                                    <option value="Máy chủ">Máy chủ</option>
                                    <option value="Scan HT">Scan HT</option>
                                </select>
                            </div>
                        </label>

                        <label className="min-w-[180px] flex-1">
                            <span className={fieldLabelClassName}>Trạng thái</span>
                            <select
                                value={filters.status}
                                onChange={(event) => handleChange("status", event.target.value)}
                                className={fieldClassName}
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="Chưa sử dụng">Chưa sử dụng</option>
                                <option value="Đang sử dụng">Đang sử dụng</option>
                                <option value="Chờ thanh lý">Chờ thanh lý</option>
                                <option value="Đã thanh lý">Đã thanh lý</option>
                                <option value="Thuê ngoài">Thuê ngoài</option>
                            </select>
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

                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="cursor-pointer h-10 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            Lọc dữ liệu
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

                        <label>
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
                                {value}
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
