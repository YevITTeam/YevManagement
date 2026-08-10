"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { JobTitlePermissionApi } from "@/modules/attendance/api/job-title-permission.api";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import type { PermissionDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Tab "Quyền theo Chức vụ" (2026-08-10) — chọn 1 Chức vụ, tick những permission nhóm "tham gia quy
// trình" (danh sách CỐ ĐỊNH lấy từ BE, GET /JobTitlePermission/allowed-codes) sẽ tự động cấp cho MỌI
// người đang giữ Chức vụ đó (có UserName link tài khoản đăng nhập) — đồng bộ thật diễn ra ở BE
// (EmployeeService khi đổi JobTitleId/UserName, và JobTitlePermissionService.ReplaceAsync khi sửa
// mapping này) qua UserPermission.IsAutoGranted, KHÔNG đụng permission Admin đã cấp tay riêng qua
// "Tuỳ chỉnh quyền" — xem docs/docs-be/attendance-module.md §Cây chức vụ, mục "Quyền theo Chức vụ".
// Không phải màn CRUD chuẩn nên implement ListHandle tối giản (openCreate no-op).
const JobTitlePermissionManager = forwardRef<ListHandle, ListToolbarProps>(function JobTitlePermissionManager(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.JobTitlePermission");

    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [allowedCodes, setAllowedCodes] = useState<string[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
    const [jobTitleId, setJobTitleId] = useState<number | "">("");
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isLoadingMapping, setIsLoadingMapping] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setIsLoadingOptions(true);
        Promise.all([JobTitleApi.getAllJobTitles(), JobTitlePermissionApi.getAllowedCodes(), PermissionApi.getAll()])
            .then(([jobTitleData, allowedData, permissionGroups]) => {
                setJobTitles(jobTitleData);
                setAllowedCodes(allowedData);
                setAllPermissions(permissionGroups.flatMap((g) => g.entities.flatMap((e) => e.permissions)));
            })
            .catch((err) => {
                console.error(err);
                toast.error(t("loadOptionsError"));
            })
            .finally(() => setIsLoadingOptions(false));
    }, [t]);

    useEffect(() => {
        onLoadingChange?.(isLoadingOptions);
    }, [isLoadingOptions, onLoadingChange]);

    const fetchMapping = (targetJobTitleId: number) => {
        setIsLoadingMapping(true);
        JobTitlePermissionApi.getByJobTitle(targetJobTitleId)
            .then((data) => {
                setSelectedCodes(new Set(data.map((x) => x.permissionCode)));
                setIsDirty(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("loadMappingError")));
            })
            .finally(() => setIsLoadingMapping(false));
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (typeof jobTitleId === "number") fetchMapping(jobTitleId);
        },
        openCreate: () => {},
    }));

    const handleSelectJobTitle = (value: string) => {
        const nextId = value ? Number(value) : "";
        setJobTitleId(nextId);
        setSelectedCodes(new Set());
        setIsDirty(false);
        if (typeof nextId === "number") fetchMapping(nextId);
    };

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
        if (typeof jobTitleId !== "number") return;
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
        <div className="space-y-4">
            <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <p className="text-sm text-[#5e3f3a]">{t("description")}</p>

                <label className="block max-w-sm">
                    <span className={fieldLabelClassName}>{t("fieldJobTitle")}</span>
                    <select
                        value={jobTitleId}
                        onChange={(event) => handleSelectJobTitle(event.target.value)}
                        disabled={isLoadingOptions}
                        className={fieldClassName}
                    >
                        <option value="">{t("fieldJobTitlePlaceholder")}</option>
                        {jobTitles.map((jobTitle) => (
                            <option key={jobTitle.id} value={jobTitle.id}>
                                {jobTitle.name} ({jobTitle.code}, cấp {jobTitle.rankOrder})
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            {typeof jobTitleId === "number" && (
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    {isLoadingMapping ? (
                        <p className="text-sm text-[#5e3f3a]">{t("loadingMapping")}</p>
                    ) : (
                        <>
                            {allowedPermissions.length === 0 ? (
                                <p className="text-sm text-[#5e3f3a]">{t("noAllowedPermissions")}</p>
                            ) : (
                                <ul className="space-y-1.5">
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
                                                            checked
                                                                ? "border-[#e3000f] bg-[#e3000f] text-white"
                                                                : "border-[#e0e3e5] bg-white"
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
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!isDirty || isSaving}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSaving ? t("saving") : t("saveButton")}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );
});

export default JobTitlePermissionManager;
