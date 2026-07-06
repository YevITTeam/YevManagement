"use client";

import { ChevronDown, ChevronUp, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export interface DeviceFilters {
    search: string;
    branch: string;
    deviceType: string;
    status: string;
    supplier: string;
    purchaseFrom: string;
    purchaseTo: string;
    expiryDate: string;
}

export interface DeviceFilterBarProps {
    onFilter: (filters: DeviceFilters) => void;
}

const defaultFilters: DeviceFilters = {
    search: "",
    branch: "",
    deviceType: "",
    status: "",
    supplier: "",
    purchaseFrom: "",
    purchaseTo: "",
    expiryDate: "",
};

const selectClassName =
    "h-10 w-full rounded-md border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

export default function DeviceFilterBar({ onFilter }: DeviceFilterBarProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [filters, setFilters] = useState<DeviceFilters>(defaultFilters);

    const hasActiveFilters = useMemo(() => {
        return Object.values(filters).some((value) => value !== "");
    }, [filters]);

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

    return (
        <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap">
                        <label className="min-w-[240px] flex-1">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Tìm kiếm chung
                            </span>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={filters.search}
                                    onChange={(event) => handleChange("search", event.target.value)}
                                    placeholder="Nhập Mã thiết bị, IP, Người QL..."
                                    className="h-10 w-full rounded-md border border-[#e0e3e5] bg-[#f8fafc] pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:bg-white focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </div>
                        </label>

                        <label className="min-w-[160px] flex-1">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Chi nhánh
                            </span>
                            <select value={filters.branch} onChange={(event) => handleChange("branch", event.target.value)} className={selectClassName}>
                                <option value="">Tất cả chi nhánh</option>
                                <option value="Hà Nội">Hà Nội</option>
                                <option value="Đà Nẵng">Đà Nẵng</option>
                                <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                                <option value="Trà Vinh">Trà Vinh</option>
                            </select>
                        </label>

                        <label className="min-w-[170px] flex-1">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Loại thiết bị
                            </span>
                            <select value={filters.deviceType} onChange={(event) => handleChange("deviceType", event.target.value)} className={selectClassName}>
                                <option value="">Tất cả loại</option>
                                <option value="Máy bàn">Máy bàn</option>
                                <option value="Laptop">Laptop</option>
                                <option value="Máy chủ">Máy chủ</option>
                                <option value="Scan HT">Scan HT</option>
                            </select>
                        </label>

                        <label className="min-w-[180px] flex-1">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Trạng thái
                            </span>
                            <select value={filters.status} onChange={(event) => handleChange("status", event.target.value)} className={selectClassName}>
                                <option value="">Tất cả trạng thái</option>
                                <option value="Đang sử dụng">Đang sử dụng</option>
                                <option value="Chờ thanh lý">Chờ thanh lý</option>
                                <option value="Đang thuê ngoài">Đang thuê ngoài</option>
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen((current) => !current)}
                            className="flex h-10 items-center gap-2 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f8fafc]"
                        >
                            <Filter className="h-4 w-4" />
                            Bộ lọc nâng cao
                            {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex h-10 items-center gap-2 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f8fafc]"
                        >
                            <X className="h-4 w-4" />
                            Xóa bộ lọc
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="h-10 rounded-md bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            Lọc dữ liệu
                        </button>
                    </div>
                </div>

                {isAdvancedOpen && (
                    <div className="grid gap-3 border-t border-[#e0e3e5] pt-4 md:grid-cols-2 xl:grid-cols-3">
                        <label>
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Nhà cung cấp
                            </span>
                            <select value={filters.supplier} onChange={(event) => handleChange("supplier", event.target.value)} className={selectClassName}>
                                <option value="">Tất cả nhà CC</option>
                                <option value="FPT">FPT</option>
                                <option value="Dell">Dell</option>
                                <option value="Đinh T">Đinh T</option>
                            </select>
                        </label>

                        <label>
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Từ ngày
                            </span>
                            <input
                                type="date"
                                value={filters.purchaseFrom}
                                onChange={(event) => handleChange("purchaseFrom", event.target.value)}
                                className={selectClassName}
                            />
                        </label>

                        <label>
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Đến ngày
                            </span>
                            <input
                                type="date"
                                value={filters.purchaseTo}
                                onChange={(event) => handleChange("purchaseTo", event.target.value)}
                                className={selectClassName}
                            />
                        </label>

                        <label>
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                Hạn sử dụng
                            </span>
                            <input
                                type="date"
                                value={filters.expiryDate}
                                onChange={(event) => handleChange("expiryDate", event.target.value)}
                                className={selectClassName}
                            />
                        </label>
                    </div>
                )}

                {hasActiveFilters && (
                    <div className="rounded-md bg-[#f8fafc] px-3 py-2 text-sm text-[#5e3f3a]">
                        Đang áp dụng bộ lọc cho dữ liệu thiết bị.
                    </div>
                )}
            </div>
        </section>
    );
}
