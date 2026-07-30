"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Save } from "lucide-react";

import { AssetSettingApi } from "@/modules/pc-management/api/asset-setting.api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// GET/PUT /api/AssetSetting — cấu hình chung module Asset: thiết bị hết hạn sử dụng chuyển "Chờ
// thanh lý" NGAY (không phụ thuộc cấu hình này); sau bao nhiêu tháng kể từ ngày hết hạn mà thiết bị
// vẫn ở "Chờ thanh lý" thì hệ thống mới tự động chuyển tiếp sang "Đã thanh lý" (DeviceLiquidationBackgroundService).
export default function AssetSettingPanel() {
    const [isSaving, setIsSaving] = useState(false);
    const [liquidationAfterMonths, setLiquidationAfterMonths] = useState<number>(1);

    const { isLoading } = useFetchEffect(
        () => AssetSettingApi.getAssetSetting(),
        [],
        (data) => setLiquidationAfterMonths(data.liquidationAfterMonths),
        "Không thể tải cấu hình.",
        (message) => toast.error(message)
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!Number.isInteger(liquidationAfterMonths) || liquidationAfterMonths < 1) {
            toast.error("Số tháng phải là số nguyên và lớn hơn hoặc bằng 1.");
            return;
        }
        setIsSaving(true);
        try {
            const data = await AssetSettingApi.updateAssetSetting({ liquidationAfterMonths });
            setLiquidationAfterMonths(data.liquidationAfterMonths);
            toast.success("Cập nhật cấu hình thành công");
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật cấu hình thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Cài đặt hệ thống</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">Cấu hình chung áp dụng cho toàn bộ module Quản lý PC/Thiết bị.</p>
            </div>

            <section className="max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-[#191c1e]">Tự động chuyển trạng thái thanh lý</h2>
                <p className="mt-1 text-sm text-[#5e3f3a]">
                    Khi thiết bị hết hạn sử dụng (Hết hạn = Ngày mua + Số tháng khấu hao), hệ thống tự động chuyển
                    trạng thái sang <strong>&quot;Chờ thanh lý&quot;</strong> ngay lập tức. Sau đó, nếu thiết bị vẫn ở
                    &quot;Chờ thanh lý&quot; quá <strong>số tháng cấu hình bên dưới</strong> (tính từ ngày hết hạn), hệ
                    thống sẽ tự động chuyển tiếp sang <strong>&quot;Đã thanh lý&quot;</strong>.
                </p>

                {isLoading ? (
                    <div className="mt-6 h-10 w-40 animate-pulse rounded-lg bg-[#eceef0]" />
                ) : (
                    <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-end gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>Số tháng &quot;Chờ thanh lý&quot; trước khi tự thanh lý (kể từ ngày hết hạn)</span>
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

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
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
