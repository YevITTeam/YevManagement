"use client";

import { useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Check, Info, Search } from "lucide-react";

import { JobTitlePermissionApi } from "@/modules/attendance/api/job-title-permission.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { PermissionDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Lets the parent form save this mapping together with its own fields (one Save button in the dialog).
export interface JobTitlePermissionSectionHandle {
    isDirty: () => boolean;
    // Resolves true when nothing needed saving or the save succeeded.
    save: () => Promise<boolean>;
}

interface JobTitlePermissionSectionProps {
    jobTitleId: number;
    ref?: React.Ref<JobTitlePermissionSectionHandle>;
}

// Separate API from the title fields, but the parent form calls `save()` first so the user sees one Save button.
export default function JobTitlePermissionSection({ jobTitleId, ref }: JobTitlePermissionSectionProps) {
    const t = useTranslations("Attendance.JobTitlePermission");

    const [allowedCodes, setAllowedCodes] = useState<string[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [isDirty, setIsDirty] = useState(false);
    const [keyword, setKeyword] = useState("");

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

    useImperativeHandle(ref, () => ({
        isDirty: () => isDirty,
        save: async () => {
            if (!isDirty) return true;
            try {
                const data = await JobTitlePermissionApi.replaceByJobTitle(jobTitleId, Array.from(selectedCodes));
                setSelectedCodes(new Set(data.map((x) => x.permissionCode)));
                setIsDirty(false);
                return true;
            } catch (err) {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("saveError")));
                return false;
            }
        },
    }));

    const handleToggle = (code: string) => {
        setSelectedCodes((current) => {
            const next = new Set(current);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
        setIsDirty(true);
    };

    // Keep BE's allowedCodes order (grouped by Module > Entity) rather than the flattened order.
    const allowedPermissions = allowedCodes
        .map((code) => allPermissions.find((p) => p.code === code))
        .filter((p): p is PermissionDto => p !== undefined);

    const normalizedKeyword = keyword.trim().toLowerCase();
    const visiblePermissions = normalizedKeyword
        ? allowedPermissions.filter(
              (p) => p.description.toLowerCase().includes(normalizedKeyword) || p.code.toLowerCase().includes(normalizedKeyword)
          )
        : allowedPermissions;

    const setMany = (codes: string[], checked: boolean) => {
        setSelectedCodes((current) => {
            const next = new Set(current);
            codes.forEach((code) => (checked ? next.add(code) : next.delete(code)));
            return next;
        });
        setIsDirty(true);
    };
    const allVisibleChecked = visiblePermissions.length > 0 && visiblePermissions.every((p) => selectedCodes.has(p.code));

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-[#e0e3e5] pt-3">
            <div className="flex flex-wrap items-center gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[#191c1e]">
                    {t("sectionTitle")}
                    <span title={t("description")} className="cursor-help text-[#8a8f94]">
                        <Info className="h-3.5 w-3.5" />
                    </span>
                </h4>
                {!isLoading && allowedPermissions.length > 0 && (
                    <>
                        <span className="rounded-full bg-[#f2f4f7] px-2 text-[11px] font-semibold leading-5 text-[#5e3f3a]">
                            {t("selectedCount", { count: allowedPermissions.filter((p) => selectedCodes.has(p.code)).length, total: allowedPermissions.length })}
                        </span>
                        <div className="relative ml-auto w-44">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
                            <input
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
                                placeholder={t("searchPlaceholder")}
                                className="h-7 w-full rounded-md border border-[#e0e3e5] bg-white pl-7 pr-2 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setMany(visiblePermissions.map((p) => p.code), !allVisibleChecked)}
                            className="cursor-pointer text-xs! font-semibold! text-[#e3000f] transition hover:text-[#b40009]"
                        >
                            {allVisibleChecked ? t("clearAll") : t("selectAll")}
                        </button>
                    </>
                )}
            </div>

            {isLoading ? (
                <p className="text-sm text-[#5e3f3a]">{t("loadingMapping")}</p>
            ) : allowedPermissions.length === 0 ? (
                <p className="text-sm text-[#5e3f3a]">{t("noAllowedPermissions")}</p>
            ) : (
                <ul className="grid min-h-0 flex-1 auto-rows-min gap-x-2 gap-y-0.5 overflow-y-auto rounded-lg border border-[#e0e3e5] p-1.5 sm:grid-cols-2">
                    {visiblePermissions.map((permission) => {
                        const checked = selectedCodes.has(permission.code);
                        return (
                            <li key={permission.code}>
                                <button
                                    type="button"
                                    onClick={() => handleToggle(permission.code)}
                                    title={permission.code}
                                    aria-pressed={checked}
                                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-[13px]! transition hover:bg-[#f2f4f7] ${
                                        checked ? "bg-[#fff4f2]" : ""
                                    }`}
                                >
                                    <span
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                            checked ? "border-[#e3000f] bg-[#e3000f] text-white" : "border-[#c7ccd1] bg-white"
                                        }`}
                                    >
                                        {checked && <Check size={11} />}
                                    </span>
                                    <span className="min-w-0 truncate text-[#191c1e]">{permission.description}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
