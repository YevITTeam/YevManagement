"use client";

import { Building2, ChevronDown, ChevronUp, Pencil, Plus, Trash2, UserPlus, Users, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrgUnitTreeDto, OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";

export interface LevelInfo {
    name: string;
    icon: LucideIcon;
    isTop: boolean;
}

interface ChartActions {
    levels: Map<number, LevelInfo>;
    collapsedIds: Set<number>;
    canManage: boolean;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onAssignMember: (node: OrgUnitTreeDto) => void;
    onEdit: (id: number) => void;
    onDelete: (node: OrgUnitTreeDto) => void;
}

const actionClassName =
    "flex size-6 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e]";

// Highest-ranked member (smallest RankOrder); people without a job title rank last.
function pickLeader(members: OrgUnitTreeMemberDto[]) {
    return members.reduce<OrgUnitTreeMemberDto | null>((best, member) => {
        if (!best) return member;
        const rank = member.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;
        const bestRank = best.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;
        return rank < bestRank ? member : best;
    }, null);
}

function initialOf(fullName: string) {
    const lastWord = fullName.trim().split(/\s+/).pop() ?? "";
    return lastWord.charAt(0).toUpperCase();
}

function ChartCard({ node, levels, collapsedIds, canManage, onToggle, onAddChild, onAssignMember, onEdit, onDelete }: ChartActions & { node: OrgUnitTreeDto }) {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");
    const level = levels.get(node.orgLevelId);
    const LevelIcon = level?.icon ?? Building2;
    const leader = pickLeader(node.members);
    const hasChildren = node.children.length > 0;
    const expanded = !collapsedIds.has(node.id);
    const memberList = node.members.map((member) => `${member.employeeFullName} — ${member.jobTitleNameVn ?? t("treeMemberNoJobTitle")}`).join("\n");

    return (
        <div className="group relative w-56 rounded-lg border border-[#e0e3e5] bg-white p-2.5 text-left shadow-sm transition-colors hover:border-[#c9cdd1]">
            <div className="flex items-start gap-2">
                <span
                    title={level?.name}
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                        level?.isTop ? "bg-[#fff4f2] text-[#e3000f]" : "bg-[#f2f4f6] text-[#5e3f3a]"
                    }`}
                >
                    <LevelIcon className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#191c1e]" title={node.nameVn}>
                        {node.nameVn}
                    </p>
                    <p className="font-mono text-xs text-[#8a8f94]">{node.code}</p>
                </div>
            </div>

            {leader && (
                <div className="mt-2 flex items-center gap-2 border-t border-[#f1f5f9] pt-2" title={memberList}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-xs font-semibold text-[#5e3f3a]">
                        {initialOf(leader.employeeFullName)}
                    </span>
                    <span className="min-w-0 leading-tight">
                        <span className="block truncate text-xs font-medium text-[#191c1e]">{leader.employeeFullName}</span>
                        <span className="block truncate text-xs text-[#5e3f3a]">{leader.jobTitleNameVn ?? t("treeMemberNoJobTitle")}</span>
                    </span>
                </div>
            )}

            {(node.members.length > 0 || canManage) && (
                <div className="mt-2 flex h-6 items-center justify-between">
                    {node.members.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[#5e3f3a]" title={t("memberCountTitle")}>
                            <Users className="size-3.5" /> {node.members.length}
                        </span>
                    ) : (
                        <span />
                    )}
                    {canManage && (
                        <div className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                            <button type="button" onClick={() => onAddChild(node.id)} title={t("actionAddChild")} aria-label={t("actionAddChild")} className={actionClassName}>
                                <Plus className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => onAssignMember(node)} title={t("actionAssignMember")} aria-label={t("actionAssignMember")} className={actionClassName}>
                                <UserPlus className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => onEdit(node.id)} title={tCommon("edit")} aria-label={tCommon("edit")} className={actionClassName}>
                                <Pencil className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(node)}
                                title={tCommon("delete")}
                                aria-label={tCommon("delete")}
                                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-[#930006] transition hover:bg-[#fff4f2]"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {hasChildren && (
                <button
                    type="button"
                    onClick={() => onToggle(node.id)}
                    aria-expanded={expanded}
                    title={expanded ? t("collapseBranch") : t("expandBranch")}
                    className="absolute -bottom-3 left-1/2 z-10 flex h-6 -translate-x-1/2 cursor-pointer items-center gap-0.5 rounded-full border border-[#e0e3e5] bg-white px-1.5 text-xs font-medium tabular-nums text-[#5e3f3a] shadow-sm transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                >
                    {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {node.children.length}
                </button>
            )}
        </div>
    );
}

// One branch of the chart: the unit card on top, then a bus line fanning out to its children.
function ChartBranch({ node, ...actions }: ChartActions & { node: OrgUnitTreeDto }) {
    const expanded = !actions.collapsedIds.has(node.id);
    const showChildren = node.children.length > 0 && expanded;

    return (
        <div className="flex flex-col items-center">
            <ChartCard node={node} {...actions} />
            {showChildren && (
                <>
                    <div className="h-6 w-px bg-[#c9cdd1]" />
                    <div className="flex">
                        {node.children.map((child, index) => {
                            const isFirst = index === 0;
                            const isLast = index === node.children.length - 1;
                            const hasSiblings = node.children.length > 1;
                            return (
                                <div key={child.id} className="relative flex flex-col items-center px-2 pt-4">
                                    {hasSiblings && (
                                        <div
                                            className={`absolute top-0 h-px bg-[#c9cdd1] ${
                                                isFirst ? "left-1/2 right-0" : isLast ? "left-0 right-1/2" : "left-0 right-0"
                                            }`}
                                        />
                                    )}
                                    <div className="absolute left-1/2 top-0 h-4 w-px bg-[#c9cdd1]" />
                                    <ChartBranch node={child} {...actions} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// Top-down org chart. The canvas scrolls sideways when the chart is wider than the card.
export default function OrgUnitChart({ nodes, ...actions }: ChartActions & { nodes: OrgUnitTreeDto[] }) {
    return (
        <div className="overflow-x-auto p-6 pb-8">
            <div className="flex w-max min-w-full items-start justify-center">
                {nodes.map((node) => (
                    <div key={node.id} className="px-2">
                        <ChartBranch node={node} {...actions} />
                    </div>
                ))}
            </div>
        </div>
    );
}
