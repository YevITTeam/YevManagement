"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";

interface OrgUnitMemberTreeProps {
    members: OrgUnitTreeMemberDto[];
    baseIndentRem: number;
}

// RankOrder chỉ để SẮP XẾP/HIỂN THỊ (workflow-module.md §3.1 JobTitles — "KHÔNG dùng suy luận luồng
// duyệt"), không mang quan hệ báo cáo từng-người-với-người. Vì vậy gộp nhóm theo giá trị RankOrder:
// người CÙNG cấp bậc thẳng hàng ngang nhau, cấp thấp hơn (RankOrder lớn hơn) thụt vào 1 mức — chưa
// gán chức danh coi như cấp thấp nhất, luôn nằm trong cùng.
function groupByRank(members: OrgUnitTreeMemberDto[]): OrgUnitTreeMemberDto[][] {
    const byRank = new Map<number, OrgUnitTreeMemberDto[]>();
    for (const member of members) {
        const rank = member.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;
        const group = byRank.get(rank);
        if (group) group.push(member);
        else byRank.set(rank, [member]);
    }
    return [...byRank.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, group]) => group.slice().sort((a, b) => a.employeeFullName.localeCompare(b.employeeFullName)));
}

// Cụm 1 cấp bậc — kiểu cây thư mục Windows: nút mũi tên gắn ở dòng đầu cụm để gộp/mở TOÀN BỘ các cấp
// thấp hơn lồng bên trong (không gắn theo từng cá nhân, vì dữ liệu không có quan hệ báo cáo cụ thể).
function MemberTierGroup({ tiers, depth }: { tiers: OrgUnitTreeMemberDto[][]; depth: number }) {
    const t = useTranslations("Workflow.OrgUnit");
    const [expanded, setExpanded] = useState(true);

    if (tiers.length === 0) return null;
    const [current, ...rest] = tiers;
    const hasDeeper = rest.length > 0;

    return (
        <div>
            {current.map((member, index) => (
                <div
                    key={`${member.employeeId}-${member.jobTitleId ?? "none"}`}
                    className="flex items-center gap-1 py-0.5 text-xs text-[#5e3f3a]"
                    style={{ paddingLeft: `${depth}rem` }}
                >
                    {index === 0 && hasDeeper ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((current) => !current)}
                            className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-[#8a8f94] hover:text-[#191c1e]"
                        >
                            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                    ) : (
                        <span className="h-4 w-4 shrink-0" />
                    )}
                    <User className="h-3 w-3 shrink-0 text-[#8a8f94]" />
                    <span className="truncate">
                        {member.jobTitleNameVn ?? t("treeMemberNoJobTitle")}:{" "}
                        <span className="font-medium text-[#191c1e]">{member.employeeFullName}</span>
                    </span>
                </div>
            ))}
            {hasDeeper && expanded && <MemberTierGroup tiers={rest} depth={depth + 1.25} />}
        </div>
    );
}

export default function OrgUnitMemberTree({ members, baseIndentRem }: OrgUnitMemberTreeProps) {
    if (members.length === 0) return null;
    return (
        <div className="pb-1.5">
            <MemberTierGroup tiers={groupByRank(members)} depth={baseIndentRem} />
        </div>
    );
}
