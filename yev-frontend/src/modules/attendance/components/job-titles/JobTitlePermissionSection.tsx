"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { JobTitlePermissionApi } from "@/modules/attendance/api/job-title-permission.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { PermissionDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface JobTitlePermissionSectionProps {
    jobTitleId: number;
}

// Tích hợp thẳng vào JobTitleForm (2026-09-03d, theo yêu cầu người dùng — trước đó là tab riêng
// "Quyền theo Chức vụ" ở CategoryManagement.tsx, nay gộp vào đúng modal Sửa chức vụ để không phải
// chuyển tab). Rút gọn từ JobTitlePermissionManager.tsx cũ (đã xoá) — bỏ phần chọn Chức vụ (nhận thẳng
// `jobTitleId` từ form cha), giữ nguyên logic tick/lưu + nguồn dữ liệu
// (GET /JobTitlePermission/allowed-codes, GET .../by-job-title/{id}, PUT .../by-job-title/{id}) — xem
// docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ". Lưu RIÊNG với Save chính
// của JobTitleForm (2 API khác nhau — sửa Code/Name/TerminalLevel không liên quan gì tới mapping quyền
// này), có nút Lưu độc lập ngay trong section.
export default function JobTitlePermissionSection({ jobTitleId }: JobTitlePermissionSectionProps) {
    const t = useTranslations("Attendance.JobTitlePermission");

    const [allowedCodes, setAllowedCodes] = useState<string[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const { isLoading } = useFetchEffect(
        () =>
            Promise.all([
                JobTitlePermissionApi.getAllowedCodes(),
                PermissionApi.getAll(),
                JobTitlePermissionApi.getByJobTitle(jobTitleId),
            ]),
        [jobTitleId],
        ([allowedData, permissionGroups, mapping]) => {
            setAllowedCodes(allowedData);
            setAllPermissions(permissionGroups.flatMap((g) => g.entities.flatMap((e) => e.permissions)));
            setSelectedCodes(new Set(mapping.map((x) => x.permissionCode)));
            setIsDirty(false);
        },
        t("loadMappingError")
    );

    const handleToggle = (code: string) => {
        setSelectedCodes((current) => {
            const next = new Set(current);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = await JobTitlePermissionApi.replaceByJobTitle(jobTitleId, Array.from(selectedCodes));
            setSelectedCodes(new Set(data.map((x) => x.permissionCode)));
            setIsDirty(false);
            toast.success(t("saveSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    // Chỉ hiện đúng permission nằm trong danh sách BE cho phép — thứ tự giữ theo thứ tự allowedCodes
    // (đã nhóm sẵn theo Module > Entity) thay vì thứ tự ngẫu nhiên sau khi flatten.
    const allowedPermissions = allowedCodes
        .map((code) => allPermissions.find((p) => p.code === code))
        .filter((p): p is PermissionDto => p !== undefined);

    return (
        <div className="space-y-3 border-t border-[#e0e3e5] pt-4">
            <div>
                <h4 className="text-sm font-semibold text-[#191c1e]">{t("sectionTitle")}</h4>
                <p className="mt-1 text-xs text-[#5e3f3a]">{t("description")}</p>
            </div>

            {isLoading ? (
                <p className="text-sm text-[#5e3f3a]">{t("loadingMapping")}</p>
            ) : allowedPermissions.length === 0 ? (
                <p className="text-sm text-[#5e3f3a]">{t("noAllowedPermissions")}</p>
            ) : (
                <>
                    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[#e0e3e5] p-2">
                        {allowedPermissions.map((permission) => {
                            const checked = selectedCodes.has(permission.code);
                            return (
                                <li key={permission.code}>
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(permission.code)}
                                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:bg-[#f8fafc]"
                                    >
                                        <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                checked ? "border-[#e3000f] bg-[#e3000f] text-white" : "border-[#e0e3e5] bg-white"
                                            }`}
                                        >
                                            {checked && <Check size={11} />}
                                        </span>
                                        <span className="text-[#191c1e]">{permission.description}</span>
                                        <span className="ml-auto shrink-0 font-mono text-xs text-[#8a8f94]">{permission.code}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? t("saving") : t("saveButton")}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
