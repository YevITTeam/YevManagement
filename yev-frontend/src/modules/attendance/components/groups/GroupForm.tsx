"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import { ProductionCatalogApi } from "@/modules/attendance/api/production-catalog.api";
import type { ProductionCatalogItemDto } from "@/modules/attendance/types/production-catalog.dto";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import type { GroupDto, GroupLineDto } from "@/modules/attendance/types/group.dto";
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
    lineKind: string | null;
    // Empty = the server adds "Line = group name × HC".
    lines: GroupLineDto[];
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
    lineKind: null,
    lines: [],
};

const LINE_KINDS = ["TT", "GT"];

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
    const [lines, setLines] = useState<ProductionCatalogItemDto[]>([]);
    const [shiftTeams, setShiftTeams] = useState<ProductionCatalogItemDto[]>([]);
    const [newLineId, setNewLineId] = useState<number | "">("");
    const [newShiftId, setNewShiftId] = useState<number | "">("");

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
        ProductionCatalogApi.getPage("Line", { pageIndex: 1, pageSize: 1000 })
            .then((res) => setLines(res.data))
            .catch((err) => console.error(err));
        ProductionCatalogApi.getPage("ShiftTeam", { pageIndex: 1, pageSize: 100 })
            .then((res) => setShiftTeams(res.data))
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
                      lineKind: current.lineKind,
                      lines: current.lines,
                  }
                : emptyValues
        );
        setNewLineId("");
        setNewShiftId("");
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

    // Only lines of the group's workshop that have staff of the chosen kind.
    const lineOptions: SelectOption[] = lines
        .filter((l) => l.workshopId === values.workshopId)
        .filter((l) => values.lineKind !== "TT" || l.hasDirectStaff)
        .filter((l) => values.lineKind !== "GT" || l.hasIndirectStaff)
        .map((l) => ({ value: l.id, label: l.code, searchText: l.code.toLowerCase() }));

    const pairLabel = (pair: GroupLineDto) => {
        const lineCode = pair.lineCode ?? lines.find((l) => l.id === pair.productionLineId)?.code;
        const shiftCode = pair.shiftTeamCode ?? shiftTeams.find((s) => s.id === pair.shiftTeamId)?.code;
        return `${lineCode} · ${shiftCode}`;
    };

    const addLine = () => {
        if (newLineId === "" || newShiftId === "") return;
        setValues((current) =>
            current.lines.some((x) => x.productionLineId === newLineId && x.shiftTeamId === newShiftId)
                ? current
                : { ...current, lines: [...current.lines, { productionLineId: newLineId, shiftTeamId: newShiftId }] }
        );
        setNewLineId("");
    };

    const removeLine = (pair: GroupLineDto) =>
        setValues((current) => ({
            ...current,
            lines: current.lines.filter((x) => x.productionLineId !== pair.productionLineId || x.shiftTeamId !== pair.shiftTeamId),
        }));

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.workshopId || !values.departmentId || !values.groupCode.trim() || !values.groupNameVn.trim()) return;
        if (values.lines.length > 0 && !values.lineKind) return;
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

                    <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                            <label className="block w-24">
                                <span className={fieldLabelClassName}>
                                    {t("fieldLineKind")}
                                    {values.lines.length > 0 && <RequiredMark />}
                                </span>
                                <select
                                    value={values.lineKind ?? ""}
                                    onChange={(event) => setValues((current) => ({ ...current, lineKind: event.target.value || null }))}
                                    disabled={loading}
                                    required={values.lines.length > 0}
                                    className={fieldClassName}
                                >
                                    <option value="" />
                                    {LINE_KINDS.map((k) => (
                                        <option key={k} value={k}>
                                            {k}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block w-44">
                                <span className={fieldLabelClassName}>{t("fieldLine")}</span>
                                <SearchableSelect
                                    options={lineOptions}
                                    value={newLineId}
                                    onChange={setNewLineId}
                                    placeholder=""
                                    disabled={loading || !values.workshopId}
                                />
                            </label>

                            <label className="block w-32">
                                <span className={fieldLabelClassName}>{t("fieldShiftTeam")}</span>
                                <select
                                    value={newShiftId}
                                    onChange={(event) => setNewShiftId(event.target.value ? Number(event.target.value) : "")}
                                    disabled={loading}
                                    className={fieldClassName}
                                >
                                    <option value="" />
                                    {shiftTeams.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.nameVn ?? s.code}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                type="button"
                                onClick={addLine}
                                disabled={loading || newLineId === "" || newShiftId === ""}
                                title={t("addLinePair")}
                                aria-label={t("addLinePair")}
                                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        {values.lines.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {values.lines.map((pair) => (
                                    <span
                                        key={`${pair.productionLineId}-${pair.shiftTeamId}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-[#e0e3e5] bg-[#f8fafc] py-0.5 pl-2 pr-1 text-sm text-[#191c1e]"
                                    >
                                        {pairLabel(pair)}
                                        <button
                                            type="button"
                                            onClick={() => removeLine(pair)}
                                            disabled={loading}
                                            title={tCommon("delete")}
                                            aria-label={tCommon("delete")}
                                            className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[#5e3f3a] transition hover:bg-[#e8ecf1] hover:text-[#930006]"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
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
