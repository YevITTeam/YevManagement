"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Save, Undo2 } from "lucide-react";

import { AssetSettingApi } from "@/modules/pc-management/api/asset-setting.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { AssetSettingDto } from "@/modules/pc-management/types/asset-setting.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import PasswordGeneratorCard from "./PasswordGeneratorCard";

type SettingValues = Pick<AssetSettingDto, "liquidationAfterMonths" | "serverCheckBranchId">;

const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";
const secondaryButtonClassName =
    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 text-xs! font-semibold! text-[#191c1e] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";

// Liquidation soft-delete job checks daily at 00:30 but only runs after the configured month interval.
// The branch only scopes the network ping; daily QR scans follow Device.RequiresDailyCheck instead.
export default function AssetSettingPanel() {
    const [isSaving, setIsSaving] = useState(false);
    const [values, setValues] = useState<SettingValues | null>(null);
    const [saved, setSaved] = useState<SettingValues | null>(null);
    const [branches, setBranches] = useState<BranchDto[]>([]);

    const { isLoading } = useFetchEffect(
        () => Promise.all([AssetSettingApi.getAssetSetting(), BranchApi.getAllBranches()]),
        [],
        ([setting, branchList]) => {
            const loaded = { liquidationAfterMonths: setting.liquidationAfterMonths, serverCheckBranchId: setting.serverCheckBranchId };
            setValues(loaded);
            setSaved(loaded);
            setBranches(branchList);
        },
        "Không thể tải cấu hình.",
        (message) => toast.error(message),
        "asset-setting"
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!values) return;
        if (!Number.isInteger(values.liquidationAfterMonths) || values.liquidationAfterMonths < 1) {
            toast.error("Số tháng phải là số nguyên và lớn hơn hoặc bằng 1.");
            return;
        }
        setIsSaving(true);
        try {
            const data = await AssetSettingApi.updateAssetSetting(values);
            const next = { liquidationAfterMonths: data.liquidationAfterMonths, serverCheckBranchId: data.serverCheckBranchId };
            setValues(next);
            setSaved(next);
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
    const isDirty = JSON.stringify(values) !== JSON.stringify(saved);

    return (
        <div className="space-y-4">
            <h1 className="text-lg font-semibold text-[#191c1e]">Cài đặt hệ thống</h1>

            <div className="grid items-start gap-4 xl:grid-cols-2">
                <form onSubmit={handleSubmit} className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    {isLoading || !values ? (
                        <div className="space-y-3 p-4">
                            <div className="h-9 animate-pulse rounded-md bg-[#eceef0]" />
                            <div className="h-9 animate-pulse rounded-md bg-[#eceef0]" />
                        </div>
                    ) : (
                        <div className="divide-y divide-[#f1f5f9]">
                            <SettingRow
                                title="Tự động xóa thiết bị đã thanh lý"
                                desc='Xóa mềm thiết bị "Đã thanh lý" (kèm gỡ IP, ẩn email — giống thao tác xóa thủ công). Job kiểm tra mỗi ngày lúc 00:30 nhưng chỉ chạy khi đã đủ số tháng cấu hình kể từ lần chạy gần nhất.'
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-[#8a8f94]">Mỗi</span>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={values.liquidationAfterMonths}
                                        onChange={(event) => setValues({ ...values, liquidationAfterMonths: Number(event.target.value) })}
                                        disabled={isSaving}
                                        required
                                        aria-label="Số tháng giữa 2 lần tự động xóa"
                                        className={`${fieldClassName} w-20`}
                                    />
                                    <span className="text-xs text-[#8a8f94]">tháng</span>
                                </div>
                            </SettingRow>
                            <SettingRow
                                title="Chi nhánh kiểm tra network"
                                desc='Nút "Kiểm tra network" chỉ ping IP của thiết bị Server/Network/UPS thuộc chi nhánh này (gồm cả server ảo); để trống = ping tất cả chi nhánh. Danh sách thiết bị phải quét QR mỗi ngày theo ô "Cần kiểm tra hằng ngày (QR)" trên từng thiết bị, không theo chi nhánh.'
                            >
                                <div className="w-56">
                                    <SearchableSelect
                                        options={branchOptions}
                                        value={values.serverCheckBranchId ?? ""}
                                        onChange={(v) => setValues({ ...values, serverCheckBranchId: v === "" ? null : v })}
                                        placeholder="Tất cả chi nhánh"
                                        disabled={isSaving}
                                        triggerClassName={`${fieldClassName} w-full`}
                                    />
                                </div>
                            </SettingRow>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-[#e0e3e5] px-4 py-2.5">
                        {isDirty && (
                            <>
                                <span className="text-xs text-[#9a5b00]">Chưa lưu</span>
                                <button type="button" onClick={() => setValues(saved)} disabled={isSaving} className={secondaryButtonClassName}>
                                    <Undo2 className="h-3.5 w-3.5" />
                                    Hoàn tác
                                </button>
                            </>
                        )}
                        <button
                            type="submit"
                            disabled={isSaving || !isDirty}
                            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#e3000f] px-4 text-xs! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
                        </button>
                    </div>
                </form>

                <PasswordGeneratorCard />
            </div>
        </div>
    );
}

// Title left, control right; the long explanation rides the title as a tooltip (DESIGN_SYSTEM.md §4.10).
function SettingRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <h2 className="cursor-help text-sm font-semibold text-[#191c1e] decoration-dotted underline-offset-4 hover:underline" title={desc}>
                {title}
            </h2>
            {children}
        </section>
    );
}
