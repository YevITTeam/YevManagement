"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import type { OrgLevelJobTitleSuggestionDto } from "@/modules/workflow/types/org-level.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { Tabs } from "@/components/ui/Tabs";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface AssignEmployeeDialogProps {
    orgUnit: { id: number; code: string; nameVn: string; orgLevelId: number };
    onClose: () => void;
    onSaved: () => void;
}

type AssignMode = "existing" | "new";

const NO_JOB_TITLE = 0;

// Assigns one employee to the unit via the per-row API. The job title is preselected from the
// level's suggestions (a hint, not a limit). "New" mode creates the employee first.
export default function AssignEmployeeDialog({ orgUnit, onClose, onSaved }: AssignEmployeeDialogProps) {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");

    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [suggestions, setSuggestions] = useState<OrgLevelJobTitleSuggestionDto[]>([]);

    const [mode, setMode] = useState<AssignMode>("existing");
    const [employeeId, setEmployeeId] = useState<number | "">("");
    const [newCode, setNewCode] = useState("");
    const [newFullName, setNewFullName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [createdEmployeeId, setCreatedEmployeeId] = useState<number | null>(null);
    const [jobTitleId, setJobTitleId] = useState<number | null>(null);
    const [isPrimary, setIsPrimary] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [employees, titles, levelSuggestions] = await Promise.all([
                EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
                JobTitleApi.getAllJobTitles(),
                OrgLevelApi.getJobTitleSuggestions(orgUnit.orgLevelId),
            ]);
            return { employees, titles, levelSuggestions };
        },
        [orgUnit.orgLevelId],
        (result) => {
            setEmployeeOptions(
                result.employees.data
                    .filter((x) => x.isActive)
                    .map((x) => ({
                        value: x.id,
                        label: `${x.fullName} (${x.employeeCode})`,
                        searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase(),
                    }))
            );
            setJobTitles(result.titles);
            const sorted = [...result.levelSuggestions].sort((a, b) => a.sortOrder - b.sortOrder);
            setSuggestions(sorted);
            setJobTitleId(sorted[0]?.jobTitleId ?? null);
        },
        t("assignMemberLoadError"),
        (message) => toast.error(message)
    );

    const suggestedIds = new Set(suggestions.map((s) => s.jobTitleId));
    const otherJobTitles = jobTitles.filter((jt) => !suggestedIds.has(jt.id));

    const handleSave = async () => {
        if (mode === "existing" && employeeId === "") {
            toast.error(t("assignMemberEmployeeRequired"));
            return;
        }
        if (mode === "new" && createdEmployeeId === null && (!newCode.trim() || !newFullName.trim())) {
            toast.error(t("assignMemberNewRequired"));
            return;
        }

        setIsSaving(true);
        try {
            let targetEmployeeId: number;
            if (mode === "existing") {
                targetEmployeeId = employeeId as number;
            } else if (createdEmployeeId !== null) {
                targetEmployeeId = createdEmployeeId;
            } else {
                const created = await EmployeeApi.createEmployee({
                    employeeCode: newCode.trim(),
                    fullName: newFullName.trim(),
                    fullNameJp: null,
                    email: newEmail.trim() ? newEmail.trim() : null,
                    position: null,
                    userId: null,
                    isActive: true,
                });
                targetEmployeeId = created.id;
                // Kept so a retry after an assignment failure does not create the employee twice.
                setCreatedEmployeeId(created.id);
            }

            await EmployeeApi.addEmployeeOrgUnit(targetEmployeeId, {
                orgUnitId: orgUnit.id,
                jobTitleId,
                isPrimary,
                validFrom: null,
                validTo: null,
            });
            toast.success(t("assignMemberSaveSuccess"));
            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("assignMemberSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
    const selectClassName =
        "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-employee-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 id="assign-employee-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("assignMemberTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">
                            {orgUnit.nameVn} ({orgUnit.code})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-10 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                ) : (
                    <div className="space-y-4">
                        <Tabs
                            tabs={[
                                { key: "existing", label: t("assignMemberModeExisting") },
                                { key: "new", label: t("assignMemberModeNew") },
                            ]}
                            activeKey={mode}
                            onChange={(key) => !isSaving && setMode(key)}
                        />

                        {mode === "existing" ? (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("assignMemberFieldEmployee")}</span>
                                <SearchableSelect
                                    options={employeeOptions}
                                    value={employeeId}
                                    onChange={(v) => setEmployeeId(v)}
                                    placeholder={t("assignMemberFieldEmployeePlaceholder")}
                                    disabled={isSaving}
                                />
                            </label>
                        ) : (
                            <div className="space-y-4">
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("assignMemberFieldCode")}</span>
                                    <input
                                        value={newCode}
                                        onChange={(event) => setNewCode(event.target.value)}
                                        disabled={isSaving || createdEmployeeId !== null}
                                        className={selectClassName}
                                    />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("assignMemberFieldFullName")}</span>
                                    <input
                                        value={newFullName}
                                        onChange={(event) => setNewFullName(event.target.value)}
                                        disabled={isSaving || createdEmployeeId !== null}
                                        className={selectClassName}
                                    />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("assignMemberFieldEmail")}</span>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(event) => setNewEmail(event.target.value)}
                                        disabled={isSaving || createdEmployeeId !== null}
                                        className={selectClassName}
                                    />
                                </label>
                            </div>
                        )}

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("assignMemberFieldJobTitle")}</span>
                            <select
                                value={jobTitleId ?? NO_JOB_TITLE}
                                onChange={(event) => {
                                    const v = Number(event.target.value);
                                    setJobTitleId(v === NO_JOB_TITLE ? null : v);
                                }}
                                disabled={isSaving}
                                className={selectClassName}
                            >
                                <option value={NO_JOB_TITLE}>{t("assignMemberFieldJobTitleNoJobTitle")}</option>
                                {suggestions.length > 0 && (
                                    <optgroup label={t("assignMemberFieldJobTitleSuggestedGroup")}>
                                        {suggestions.map((s) => (
                                            <option key={s.jobTitleId} value={s.jobTitleId}>
                                                {s.jobTitleNameVn}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label={t("assignMemberFieldJobTitleAllGroup")}>
                                    {otherJobTitles.map((jt) => (
                                        <option key={jt.id} value={jt.id}>
                                            {jt.nameVn}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </label>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isPrimary}
                                onChange={(event) => setIsPrimary(event.target.checked)}
                                disabled={isSaving}
                                className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                            />
                            <span className="text-sm text-[#191c1e]">{t("assignMemberFieldPrimary")}</span>
                        </label>

                        <div className="flex justify-end gap-3 border-t border-[#e0e3e5] pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {tCommon("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? tCommon("processing") : tCommon("save")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
