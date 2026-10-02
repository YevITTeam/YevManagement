"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Save } from "lucide-react";

import { AssetSettingApi } from "@/modules/pc-management/api/asset-setting.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// GET/PUT /api/AssetSetting — cấu hình chung module Asset: số tháng giữa 2 lần chạy job tự động
// xóa mềm thiết bị "Đã thanh lý" (DeviceLiquidationBackgroundService, kiểm tra hàng ngày lúc 00:30
// nhưng chỉ thật sự chạy khi đủ số tháng cấu hình kể từ lần chạy trước, 2026-08-22), và chi nhánh giới
// hạn phạm vi ping của nút "Kiểm tra network" (asset-module.md §1.20). Danh sách thiết bị phải quét QR
// KHÔNG lấy theo chi nhánh mà theo cờ Device.RequiresDailyCheck (§1.19).
export default function AssetSettingPanel() {
    const [isSaving, setIsSaving] = useState(false);
    const [liquidationAfterMonths, setLiquidationAfterMonths] = useState<number>(1);
    const [serverCheckBranchId, setServerCheckBranchId] = useState<number | null>(null);
    const [branches, setBranches] = useState<BranchDto[]>([]);

    const { isLoading } = useFetchEffect(
        () => Promise.all([AssetSettingApi.getAssetSetting(), BranchApi.getAllBranches()]),
        [],
        ([setting, branchList]) => {
            setLiquidationAfterMonths(setting.liquidationAfterMonths);
            setServerCheckBranchId(setting.serverCheckBranchId);
            setBranches(branchList);
        },
        "Không thể tải cấu hình.",
        (message) => toast.error(message),
        "asset-setting"
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!Number.isInteger(liquidationAfterMonths) || liquidationAfterMonths < 1) {
            toast.error("Số tháng phải là số nguyên và lớn hơn hoặc bằng 1.");
            return;
        }
        setIsSaving(true);
        try {
            const data = await AssetSettingApi.updateAssetSetting({ liquidationAfterMonths, serverCheckBranchId });
            setLiquidationAfterMonths(data.liquidationAfterMonths);
            setServerCheckBranchId(data.serverCheckBranchId);
            toast.success("Cập nhật cấu hình thành công");
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật cấu hình thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const branchOptions: SelectOption[] = branches.map((branch) => ({
        value: branch.id,
        label: branch.branchName,
        searchText: branch.branchName.toLowerCase(),
    }));

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-semibold text-[#191c1e]">Cài đặt hệ thống</h1>
            </div>

            <section className="max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-[#191c1e]">Tự động xóa thiết bị đã thanh lý</h2>
                <p className="mt-1 text-sm text-[#5e3f3a]">
                    Hệ thống định kỳ tự động xóa mềm các thiết bị đang ở trạng thái{" "}
                    <strong>&quot;Đã thanh lý&quot;</strong> (kèm gỡ IP, ẩn email — giống thao tác xóa thủ công). Job
                    kiểm tra mỗi ngày lúc 00:30 nhưng chỉ thật sự chạy khi đã đủ{" "}
                    <strong>số tháng cấu hình bên dưới</strong> kể từ lần chạy gần nhất.
                </p>

                {isLoading ? (
                    <div className="mt-6 h-9 w-40 animate-pulse rounded-lg bg-[#eceef0]" />
                ) : (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                        <label className="block w-fit">
                            <span className={fieldLabelClassName}>Số tháng giữa 2 lần tự động xóa<RequiredMark /></span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={liquidationAfterMonths}
                                onChange={(event) => setLiquidationAfterMonths(Number(event.target.value))}
                                disabled={isSaving}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <div>
                            <label className="block w-64">
                                <span className={fieldLabelClassName}>Chi nhánh áp dụng &quot;Kiểm tra network&quot;</span>
                                <SearchableSelect
                                    options={branchOptions}
                                    value={serverCheckBranchId ?? ""}
                                    onChange={(v) => setServerCheckBranchId(v === "" ? null : v)}
                                    placeholder="Tất cả chi nhánh"
                                    disabled={isSaving}
                                    triggerClassName={`${fieldClassName} w-64`}
                                />
                            </label>
                            <p className="mt-1.5 max-w-md text-xs text-[#8a8f94]">
                                Nút &quot;Kiểm tra network&quot; chỉ ping IP của thiết bị Server/Network/UPS thuộc chi nhánh
                                này (gồm cả server ảo). Để trống nếu muốn ping mọi chi nhánh. Riêng danh sách thiết bị phải
                                quét QR mỗi ngày được quyết định bởi ô &quot;Cần kiểm tra hằng ngày (QR)&quot; trên từng thiết bị.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
}
