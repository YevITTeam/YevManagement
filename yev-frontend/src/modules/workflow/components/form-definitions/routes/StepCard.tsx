"use client";

import { ArrowUp, ArrowDown, Trash2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
    ApproverMode,
    OrgUnitScope,
    ParticipantRole,
    ParticipantSource,
    StepType,
} from "@/modules/workflow/types/form-route.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { createDefaultParticipant, type EditableStep } from "./editableRoute";

interface StepCardProps {
    step: EditableStep;
    index: number;
    totalSteps: number;
    orgUnitOptions: SelectOption[];
    employeeOptions: SelectOption[];
    jobTitleOptions: SelectOption[];
    onChange: (patch: Partial<EditableStep>) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
}

// KHÔNG gộp "w-full" ở đây — 1 số nơi dùng chung constant này còn tự thêm w-28/w-32 (participant
// row): 2 class w-* cùng lúc trên 1 phần tử khiến Tailwind chọn class nào thắng tuỳ thứ tự sinh CSS,
// từng khiến select "Người duyệt" bị kéo full-width tràn màn hình. Field nào cần full width tự thêm
// "w-full" ở nơi gọi.
const fieldBaseClassName =
    "h-9 rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const fieldClassName = `${fieldBaseClassName} w-full`;
const labelClassName = "mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]";

export default function StepCard({
    step,
    index,
    totalSteps,
    orgUnitOptions,
    employeeOptions,
    jobTitleOptions,
    onChange,
    onMoveUp,
    onMoveDown,
    onRemove,
}: StepCardProps) {
    const t = useTranslations("Workflow.FormDefinition");

    const addParticipant = () => onChange({ participants: [...step.participants, createDefaultParticipant()] });
    const removeParticipant = (clientId: string) =>
        onChange({ participants: step.participants.filter((p) => p.clientId !== clientId) });
    const updateParticipant = (clientId: string, patch: Partial<EditableStep["participants"][number]>) =>
        onChange({
            participants: step.participants.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)),
        });

    return (
        <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
            <div className="flex items-start justify-between gap-2">
                <span className="mt-1.5 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#5e3f3a]">
                    {t("stepOrderLabel", { order: index + 1 })}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={onMoveUp} disabled={index === 0} className="cursor-pointer p-1 text-[#5e3f3a] hover:text-[#191c1e] disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={onMoveDown} disabled={index === totalSteps - 1} className="cursor-pointer p-1 text-[#5e3f3a] hover:text-[#191c1e] disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={onRemove} className="flex cursor-pointer items-center gap-1 p-1 text-xs font-semibold text-[#930006] hover:text-[#e3000f]">
                        <Trash2 className="h-3.5 w-3.5" /> {t("removeStep")}
                    </button>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="col-span-2 block">
                    <span className={labelClassName}>{t("stepNameVn")}</span>
                    <input value={step.nameVn} onChange={(e) => onChange({ nameVn: e.target.value })} className={fieldClassName} />
                </label>
                <label className="block">
                    <span className={labelClassName}>{t("stepType")}</span>
                    <select value={step.stepType} onChange={(e) => onChange({ stepType: Number(e.target.value) as StepType })} className={fieldClassName}>
                        <option value={StepType.Approve}>{t("stepTypeApprove")}</option>
                        <option value={StepType.Confirm}>{t("stepTypeConfirm")}</option>
                    </select>
                </label>
                <label className="block">
                    <span className={labelClassName}>{t("approverMode")}</span>
                    <select value={step.approverMode} onChange={(e) => onChange({ approverMode: Number(e.target.value) as ApproverMode })} className={fieldClassName}>
                        <option value={ApproverMode.Any}>{t("approverModeAny")}</option>
                        <option value={ApproverMode.All}>{t("approverModeAll")}</option>
                    </select>
                </label>

                <label className="block">
                    <span className={labelClassName}>{t("orgUnitScope")}</span>
                    <select
                        value={step.orgUnitScope}
                        onChange={(e) => {
                            const scope = Number(e.target.value) as OrgUnitScope;
                            onChange({ orgUnitScope: scope, orgUnitId: scope === OrgUnitScope.Fixed ? step.orgUnitId : null });
                        }}
                        className={fieldClassName}
                    >
                        <option value={OrgUnitScope.ApplicantUnit}>{t("orgUnitScopeApplicantUnit")}</option>
                        <option value={OrgUnitScope.Fixed}>{t("orgUnitScopeFixed")}</option>
                    </select>
                </label>
                {step.orgUnitScope === OrgUnitScope.Fixed && (
                    <div className="col-span-2 md:col-span-3">
                        <span className={labelClassName}>{t("stepOrgUnit")}</span>
                        <SearchableSelect
                            options={orgUnitOptions}
                            value={step.orgUnitId ?? ""}
                            onChange={(v) => onChange({ orgUnitId: v === "" ? null : v })}
                            placeholder={t("stepOrgUnitPlaceholder")}
                            triggerClassName={fieldClassName}
                        />
                    </div>
                )}

                <label className="flex items-center gap-1.5 pt-5">
                    <input type="checkbox" checked={step.requireSignature} onChange={(e) => onChange({ requireSignature: e.target.checked })} className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f]" />
                    <span className="text-xs text-[#5e3f3a]">{t("requireSignature")}</span>
                </label>
                <label className="flex items-center gap-1.5 pt-5">
                    <input type="checkbox" checked={step.allowSendBack} onChange={(e) => onChange({ allowSendBack: e.target.checked })} className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f]" />
                    <span className="text-xs text-[#5e3f3a]">{t("allowSendBack")}</span>
                </label>
                <label className="flex items-center gap-1.5 pt-5">
                    <input type="checkbox" checked={step.allowAddApprover} onChange={(e) => onChange({ allowAddApprover: e.target.checked })} className="h-4 w-4 rounded border-[#e0e3e5] text-[#e3000f]" />
                    <span className="text-xs text-[#5e3f3a]">{t("allowAddApprover")}</span>
                </label>
            </div>

            <div className="mt-3 border-t border-[#e0e3e5] pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                    <span className={labelClassName}>{t("participants")}</span>
                    <button type="button" onClick={addParticipant} className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#191c1e] hover:text-[#e3000f]">
                        <Plus className="h-3 w-3" /> {t("addParticipant")}
                    </button>
                </div>

                {step.participants.length === 0 ? (
                    <div className="rounded border border-dashed border-[#e0e3e5] px-3 py-2 text-center text-xs text-[#8a8f94]">{t("noParticipants")}</div>
                ) : (
                    <div className="space-y-2">
                        {step.participants.map((participant) => {
                            const missingTarget = participant.employeeId === null && participant.jobTitleId === null;
                            return (
                            <div key={participant.clientId} className="flex items-center gap-2 rounded bg-white p-2">
                                <select
                                    value={participant.participantSource}
                                    onChange={(e) => {
                                        const source = Number(e.target.value) as ParticipantSource;
                                        updateParticipant(participant.clientId, {
                                            participantSource: source,
                                            employeeId: source === ParticipantSource.Employee ? participant.employeeId : null,
                                            jobTitleId: source === ParticipantSource.JobTitle ? participant.jobTitleId : null,
                                        });
                                    }}
                                    className={`${fieldBaseClassName} w-32 shrink-0`}
                                >
                                    <option value={ParticipantSource.Employee}>{t("participantSourceEmployee")}</option>
                                    <option value={ParticipantSource.JobTitle}>{t("participantSourceJobTitle")}</option>
                                </select>

                                <div className="min-w-0 flex-1">
                                    {participant.participantSource === ParticipantSource.Employee ? (
                                        <SearchableSelect
                                            options={employeeOptions}
                                            value={participant.employeeId ?? ""}
                                            onChange={(v) => updateParticipant(participant.clientId, { employeeId: v === "" ? null : v })}
                                            placeholder={t("accessTargetPlaceholderEmployee")}
                                            triggerClassName={`${fieldClassName} ${missingTarget ? "!border-[#930006] !ring-2 !ring-[#f3b4b4]" : ""}`}
                                        />
                                    ) : (
                                        <SearchableSelect
                                            options={jobTitleOptions}
                                            value={participant.jobTitleId ?? ""}
                                            onChange={(v) => updateParticipant(participant.clientId, { jobTitleId: v === "" ? null : v })}
                                            placeholder={t("participantJobTitlePlaceholder")}
                                            triggerClassName={`${fieldClassName} ${missingTarget ? "!border-[#930006] !ring-2 !ring-[#f3b4b4]" : ""}`}
                                        />
                                    )}
                                    {missingTarget && <p className="mt-1 text-[11px] font-semibold text-[#930006]">{t("participantTargetRequired")}</p>}
                                </div>

                                <select
                                    value={participant.participantRole}
                                    onChange={(e) => updateParticipant(participant.clientId, { participantRole: Number(e.target.value) as ParticipantRole })}
                                    className={`${fieldBaseClassName} w-28 shrink-0`}
                                >
                                    <option value={ParticipantRole.Approver}>{t("participantRoleApprover")}</option>
                                    <option value={ParticipantRole.Viewer}>{t("participantRoleViewer")}</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => removeParticipant(participant.clientId)}
                                    className="shrink-0 cursor-pointer p-1 text-[#930006] hover:text-[#e3000f]"
                                    aria-label={t("removeParticipant")}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
