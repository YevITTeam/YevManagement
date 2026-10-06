"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";

export function initialOf(fullName: string) {
    const lastWord = fullName.trim().split(/\s+/).pop() ?? "";
    return lastWord.charAt(0).toUpperCase();
}

// Senior ranks first (smaller RankOrder = higher); members without a job title go last.
export function sortByRank(members: OrgUnitTreeMemberDto[]) {
    return members.slice().sort((a, b) => {
        const rankA = a.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB || a.employeeFullName.localeCompare(b.employeeFullName, "vi");
    });
}

function MemberContent({ member }: { member: OrgUnitTreeMemberDto }) {
    const t = useTranslations("Workflow.OrgUnit");
    return (
        <>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-xs font-semibold text-[#5e3f3a]">
                {initialOf(member.employeeFullName)}
            </span>
            <span className="min-w-0 truncate">
                <span className="font-medium text-[#191c1e]">{member.employeeFullName}</span>
                <span className="ml-2 text-xs text-[#5e3f3a]">{member.jobTitleNameVn ?? t("treeMemberNoJobTitle")}</span>
            </span>
        </>
    );
}

function DraggableMemberRow({ member, orgUnitId }: { member: OrgUnitTreeMemberDto; orgUnitId: number }) {
    const t = useTranslations("Workflow.OrgUnit");
    const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
        id: `member-${member.assignmentId}`,
        data: { kind: "member", member, fromUnitId: orgUnitId },
    });

    return (
        <li
            ref={setNodeRef}
            className={`group/member flex min-w-0 items-center gap-2 px-2 py-1 text-sm ${isDragging ? "opacity-40" : ""}`}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                title={t("dragHandleMember")}
                aria-label={t("dragHandleMember")}
                className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[#8a8f94] opacity-0 transition hover:bg-[#eceef0] group-hover/member:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
                <GripVertical className="size-3.5" />
            </button>
            <MemberContent member={member} />
        </li>
    );
}

// People of a unit as light single-line rows: round avatar, name, then job title in muted text.
// With `draggable`, each row gets a handle to drag the person onto another unit.
export default function OrgUnitMemberTree({
    members,
    orgUnitId,
    draggable = false,
}: {
    members: OrgUnitTreeMemberDto[];
    orgUnitId: number;
    draggable?: boolean;
}) {
    if (members.length === 0) return null;

    return (
        <ul className="py-0.5">
            {sortByRank(members).map((member) =>
                draggable ? (
                    <DraggableMemberRow key={member.assignmentId} member={member} orgUnitId={orgUnitId} />
                ) : (
                    <li key={member.assignmentId} className="flex min-w-0 items-center gap-2 px-2 py-1 text-sm">
                        <MemberContent member={member} />
                    </li>
                )
            )}
        </ul>
    );
}
