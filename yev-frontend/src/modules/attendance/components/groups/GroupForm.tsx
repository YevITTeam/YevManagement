"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

export interface GroupFormValues {
    workshopId: number;
    departmentId: number;
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
    allowEatLater: boolean;
}

interface GroupFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: GroupDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: GroupFormValues) => void | Promise<void>;
}

const emptyValues: GroupFormValues = {
    workshopId: 0,
    departmentId: 0,
    groupCode: "",
    groupNameVn: "",
    groupNameJp: null,
    allowEatLater: true,
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Every group must belong to a department.
export default function GroupForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: GroupFormProps) {
    const t = useTranslations("Attendance.Group");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<GroupFormValues>(emptyValues);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        DepartmentApi.getAllDepartments()
            .then(setDepartments)
            .catch((err) => console.error(err));
        WorkshopApi.getAllWorkshops()
            .then((list) => {
                setWorkshops(list);
                if (list.length === 1) setValues((current) => (current.workshopId ? current : { ...current, workshopId: list[0].id }));
            })
            .catch((err) => console.error(err));
    }, [isOpen]);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      workshopId: current.workshopId,
                      departmentId: current.departmentId,
                      groupCode: current.groupCode,
                      groupNameVn: current.groupNameVn,
                      groupNameJp: current.groupNameJp,
                      allowEatLater: current.allowEatLater,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));

    const workshopOptions: SelectOption[] = workshops.map((w) => ({
        value: w.id,
        label: w.workshopNameVn,
        searchText: w.workshopNameVn.toLowerCase(),
    }));

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.workshopId || !values.departmentId || !values.groupCode.trim() || !values.groupNameVn.trim()) return;
        onSubmit({ ...values, groupNameJp: values.groupNameJp?.trim() ? values.groupNameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="group-form-title"
                className="z-60 mx-4 w-full max-w-xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="group-form-title" className="text-lg font-semibold text-[#191c1e]">
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

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                        <label className="block min-w-48 flex-1">
                            <span className={fieldLabelClassName}>{t("fieldWorkshop")}<RequiredMark /></span>
                            <SearchableSelect
                                options={workshopOptions}
                                value={values.workshopId || ""}
                                onChange={(v) => setValues((current) => ({ ...current, workshopId: v === "" ? 0 : v }))}
                                placeholder={t("fieldWorkshopPlaceholder")}
                                disabled={loading}
                            />
                        </label>

                        <label className="block min-w-48 flex-1">
                            <span className={fieldLabelClassName}>{t("fieldDepartment")}<RequiredMark /></span>
                            <SearchableSelect
                                options={departmentOptions}
                                value={values.departmentId || ""}
                                onChange={(v) => setValues((current) => ({ ...current, departmentId: v === "" ? 0 : v }))}
                                placeholder={t("fieldDepartmentPlaceholder")}
                                disabled={loading}
                            />
                        </label>

                        <label className="block w-32">
                            <span className={fieldLabelClassName}>{t("fieldCode")}<RequiredMark /></span>
                            <input
                                value={values.groupCode}
                                onChange={(event) => setValues((current) => ({ ...current, groupCode: event.target.value }))}
                                placeholder={t("fieldCodePlaceholder")}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block min-w-48 flex-1">
                            <span className={fieldLabelClassName}>{t("fieldNameVn")}<RequiredMark /></span>
                            <input
                                value={values.groupNameVn}
                                onChange={(event) => setValues((current) => ({ ...current, groupNameVn: event.target.value }))}
                                placeholder={t("fieldNameVnPlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block w-full">
                            <span className={fieldLabelClassName}>{t("fieldNameJp")}</span>
                            <input
                                value={values.groupNameJp ?? ""}
                                onChange={(event) => setValues((current) => ({ ...current, groupNameJp: event.target.value }))}
                                placeholder={t("fieldNameJpPlaceholder")}
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={values.allowEatLater}
                            onChange={(event) => setValues((current) => ({ ...current, allowEatLater: event.target.checked }))}
                            disabled={loading}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        <span className="text-sm text-[#191c1e]">{t("fieldAllowEatLater")}</span>
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
