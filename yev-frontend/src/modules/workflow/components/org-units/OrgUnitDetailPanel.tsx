"use client";

import { useState } from "react";
import { Pencil, Plus, Star, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import type { OrgUnitTreeDto, OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { initialOf, sortByRank } from "./OrgUnitMemberTree";

interface OrgUnitDetailPanelProps {
    node: OrgUnitTreeDto;
    levelName: string | undefined;
    parentName: string | null;
    jobTitles: JobTitleDto[];
    canManage: boolean;
    onSelect: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onAssignMember: (node: OrgUnitTreeDto) => void;
    onEdit: (id: number) => void;
    onDelete: (node: OrgUnitTreeDto) => void;
    onChanged: () => void | Promise<unknown>;
}

const NO_JOB_TITLE = 0;

const iconButtonClassName =
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50";

// Right-hand detail of the selected unit: facts, inline-editable members, and child units.
export default function OrgUnitDetailPanel({
    node,
    levelName,
    parentName,
    jobTitles,
    canManage,
    onSelect,
    onAddChild,
    onAssignMember,
    onEdit,
    onDelete,
    onChanged,
}: OrgUnitDetailPanelProps) {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");

    const [busyAssignmentId, setBusyAssignmentId] = useState<number | null>(null);
    const [removingMember, setRemovingMember] = useState<OrgUnitTreeMemberDto | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    const updateMember = async (member: OrgUnitTreeMemberDto, patch: { jobTitleId?: number | null; isPrimary?: boolean }) => {
        setBusyAssignmentId(member.assignmentId);
        try {
            await EmployeeApi.updateEmployeeOrgUnit(member.assignmentId, {
                orgUnitId: node.id,
                jobTitleId: patch.jobTitleId !== undefined ? patch.jobTitleId : member.jobTitleId,
                isPrimary: patch.isPrimary !== undefined ? patch.isPrimary : member.isPrimary,
                validFrom: null,
                validTo: null,
            });
            toast.success(t("memberUpdateSuccess"));
            await onChanged();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("memberUpdateError")));
        } finally {
            setBusyAssignmentId(null);
        }
    };

    const handleRemoveMember = async () => {
        if (!removingMember) return;
        setIsRemoving(true);
        try {
            await EmployeeApi.removeEmployeeOrgUnit(removingMember.assignmentId);
            toast.success(t("memberRemoveSuccess"));
            setRemovingMember(null);
            await onChanged();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("memberRemoveError")));
        } finally {
            setIsRemoving(false);
        }
    };

    const members = sortByRank(node.members);

    return (
        <div className="space-y-5 p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-[#191c1e]">{node.nameVn}</h2>
                    {node.nameJp && <p className="truncate text-sm text-[#5e3f3a]">{node.nameJp}</p>}
                </div>
                {canManage && (
                    <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => onEdit(node.id)} title={tCommon("edit")} aria-label={tCommon("edit")} className={iconButtonClassName}>
                            <Pencil className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(node)}
                            title={tCommon("delete")}
                            aria-label={tCommon("delete")}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[#930006] transition hover:bg-[#fff4f2]"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-[#8a8f94]">{t("detailCode")}</dt>
                <dd className="font-mono text-[#191c1e]">{node.code}</dd>
                <dt className="text-[#8a8f94]">{t("detailLevel")}</dt>
                <dd className="text-[#191c1e]">{levelName ?? "—"}</dd>
                <dt className="text-[#8a8f94]">{t("detailParent")}</dt>
                <dd className="text-[#191c1e]">{parentName ?? t("detailParentNone")}</dd>
            </dl>

            <section>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("detailMembers", { count: members.length })}
                    </h3>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => onAssignMember(node)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <UserPlus className="h-3.5 w-3.5" /> {t("detailAddMember")}
                        </button>
                    )}
                </div>

                {members.length === 0 ? (
                    <p className="rounded-lg bg-[#f8fafc] px-3 py-4 text-center text-sm text-[#8a8f94]">{t("detailNoMembers")}</p>
                ) : (
                    <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                        {members.map((member) => {
                            const busy = busyAssignmentId === member.assignmentId;
                            return (
                                <li key={member.assignmentId} className="flex items-center gap-2 px-2.5 py-2">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-xs font-semibold text-[#5e3f3a]">
                                        {initialOf(member.employeeFullName)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-[#191c1e]">{member.employeeFullName}</p>
                                        {canManage ? (
                                            <select
                                                value={member.jobTitleId ?? NO_JOB_TITLE}
                                                onChange={(event) => {
                                                    const value = Number(event.target.value);
                                                    updateMember(member, { jobTitleId: value === NO_JOB_TITLE ? null : value });
                                                }}
                                                disabled={busy}
                                                aria-label={t("memberJobTitle")}
                                                className="mt-0.5 h-7 w-full max-w-[12rem] cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-1.5 text-xs text-[#5e3f3a] outline-none transition focus:border-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value={NO_JOB_TITLE}>{t("treeMemberNoJobTitle")}</option>
                                                {jobTitles.map((jt) => (
                                                    <option key={jt.id} value={jt.id}>
                                                        {jt.nameVn}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="truncate text-xs text-[#5e3f3a]">{member.jobTitleNameVn ?? t("treeMemberNoJobTitle")}</p>
                                        )}
                                    </div>
                                    {canManage && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => !member.isPrimary && updateMember(member, { isPrimary: true })}
                                                disabled={busy || member.isPrimary}
                                                title={member.isPrimary ? t("memberIsPrimary") : t("memberSetPrimary")}
                                                aria-label={member.isPrimary ? t("memberIsPrimary") : t("memberSetPrimary")}
                                                className={`${iconButtonClassName} ${member.isPrimary ? "text-[#e3000f]" : ""}`}
                                            >
                                                <Star className={`size-3.5 ${member.isPrimary ? "fill-current" : ""}`} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRemovingMember(member)}
                                                disabled={busy}
                                                title={t("memberRemove")}
                                                aria-label={t("memberRemove")}
                                                className={iconButtonClassName}
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("detailChildren", { count: node.children.length })}
                    </h3>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => onAddChild(node.id)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Plus className="h-3.5 w-3.5" /> {t("actionAddChild")}
                        </button>
                    )}
                </div>
                {node.children.length === 0 ? (
                    <p className="rounded-lg bg-[#f8fafc] px-3 py-4 text-center text-sm text-[#8a8f94]">{t("detailNoChildren")}</p>
                ) : (
                    <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                        {node.children.map((child) => (
                            <li key={child.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(child.id)}
                                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-left text-sm transition hover:bg-[#f8fafc]"
                                >
                                    <span className="min-w-0 truncate font-medium text-[#191c1e]">{child.nameVn}</span>
                                    <span className="shrink-0 font-mono text-xs text-[#8a8f94]">{child.code}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                isOpen={removingMember !== null}
                title={t("memberRemoveTitle")}
                message={t.rich("memberRemoveMessage", {
                    name: removingMember?.employeeFullName ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isRemoving}
                onApprove={handleRemoveMember}
                onDenied={() => {
                    if (!isRemoving) setRemovingMember(null);
                }}
            />
        </div>
    );
}
