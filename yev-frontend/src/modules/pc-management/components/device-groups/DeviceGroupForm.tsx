"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface DeviceGroupFormValues {
    departmentId: number;
    groupCode: string;
    groupName: string;
}

interface DeviceGroupFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DeviceGroupDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DeviceGroupFormValues) => void | Promise<void>;
}

const emptyValues: DeviceGroupFormValues = { departmentId: 0, groupCode: "", groupName: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// docs/asset-api-fe.md §2.1 (2026-07-13) — mỗi Nhóm bắt buộc thuộc về 1 Bộ phận.
export default function DeviceGroupForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DeviceGroupFormProps) {
    const t = useTranslations("Asset.DeviceGroup");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<DeviceGroupFormValues>(emptyValues);
    const [departments, setDepartments] = useState<DeviceDepartmentDto[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        DeviceDepartmentApi.getAllDeviceDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
    }, [isOpen]);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? { departmentId: current.departmentId, groupCode: current.groupCode, groupName: current.groupName }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof DeviceGroupFormValues, value: string | number) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.departmentId || !values.groupCode.trim() || !values.groupName.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-group-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="device-group-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldDepartment")}</span>
                        <select
                            value={values.departmentId || ""}
                            onChange={(event) => handleChange("departmentId", Number(event.target.value))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value="" disabled>
                                {t("fieldDepartmentPlaceholder")}
                            </option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.departmentName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldCode")}</span>
                        <input
                            value={values.groupCode}
                            onChange={(event) => handleChange("groupCode", event.target.value)}
                            placeholder={t("fieldCodePlaceholder")}
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldName")}</span>
                        <input
                            value={values.groupName}
                            onChange={(event) => handleChange("groupName", event.target.value)}
                            placeholder={t("fieldNamePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
