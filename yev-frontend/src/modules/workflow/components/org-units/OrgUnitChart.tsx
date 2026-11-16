"use client";

import { useState, type CSSProperties } from "react";
import { Building2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrgUnitTreeDto, OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";

interface PersonNode {
    key: number;
    member: OrgUnitTreeMemberDto;
    unit: OrgUnitTreeDto;
    children: PersonNode[];
}

interface TitleRow {
    jobTitleId: number | null;
    name: string;
    count: number;
}

// Card is h-40 (160px) and the manager→report connector is 40px (h-6 stem + pt-4); rows must stay in sync with both.
const ROW_HEIGHT = 200;
const CARD_TOP = 20;

// Accent per row, top down; deeper rows reuse the last one. All pass contrast with white text.
const TIER_COLORS = ["#e3000f", "#191c1e", "#9a5b00", "#5e3f3a"];
const tierColor = (row: number) => TIER_COLORS[Math.min(row, TIER_COLORS.length - 1)];

const rankOf = (member: OrgUnitTreeMemberDto) => member.jobTitleRankOrder ?? Number.MAX_SAFE_INTEGER;

// Reporting line is inferred from the unit tree: inside a unit each rank reports to the first person of the next
// higher rank, the unit's top person reports to the nearest ancestor unit's top person.
function buildPeople(units: OrgUnitTreeDto[], upper: PersonNode | null, roots: PersonNode[]) {
    for (const unit of units) {
        const sorted = unit.members.slice().sort((a, b) => rankOf(a) - rankOf(b));
        let manager = upper;
        let tierRank: number | null = null;
        let tierHead: PersonNode | null = null;
        let unitHead: PersonNode | null = null;
        for (const member of sorted) {
            const rank = rankOf(member);
            if (rank !== tierRank) {
                if (tierHead) manager = tierHead;
                tierRank = rank;
                tierHead = null;
            }
            const node: PersonNode = { key: member.assignmentId, member, unit, children: [] };
            (manager ? manager.children : roots).push(node);
            tierHead ??= node;
            unitHead ??= node;
        }
        buildPeople(unit.children, unitHead ?? upper, roots);
    }
    return roots;
}

function collectTitles(people: PersonNode[], titles: Map<number, TitleRow & { rank: number }>) {
    for (const person of people) {
        const id = person.member.jobTitleId ?? -1;
        const existing = titles.get(id);
        if (existing) existing.count += 1;
        else titles.set(id, { jobTitleId: person.member.jobTitleId, name: person.member.jobTitleNameVn ?? "", count: 1, rank: rankOf(person.member) });
        collectTitles(person.children, titles);
    }
    return titles;
}

function initialOf(fullName: string) {
    const lastWord = fullName.trim().split(/\s+/).pop() ?? "";
    return lastWord.charAt(0).toUpperCase();
}

interface BranchProps {
    person: PersonNode;
    row: number;
    rowOfTitle: Map<number, number>;
    collapsedKeys: Set<number>;
    onToggle: (key: number) => void;
}

// A person sits on their title's row; a report whose title is not below the manager's still drops one row.
function rowOf(person: PersonNode, rowOfTitle: Map<number, number>, parentRow: number) {
    const titleRow = rowOfTitle.get(person.member.jobTitleId ?? -1) ?? parentRow + 1;
    return Math.max(titleRow, parentRow + 1);
}

function deepestRow(people: PersonNode[], rowOfTitle: Map<number, number>, collapsedKeys: Set<number>, parentRow = -1): number {
    return people.reduce((max, person) => {
        const row = rowOf(person, rowOfTitle, parentRow);
        const below = collapsedKeys.has(person.key) ? row : deepestRow(person.children, rowOfTitle, collapsedKeys, row);
        return Math.max(max, row, below);
    }, 0);
}

function PersonCard({ person, row, collapsedKeys, onToggle }: Omit<BranchProps, "rowOfTitle">) {
    const t = useTranslations("Workflow.OrgUnit");
    const color = tierColor(row);
    const { member, unit } = person;
    const reports = person.children.length;
    const expanded = !collapsedKeys.has(person.key);

    return (
        <div className="relative h-40 w-48 pt-7">
            <span
                className="absolute left-1/2 top-0 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-full text-lg font-semibold text-white ring-4 ring-white"
                style={{ backgroundColor: color }}
            >
                {initialOf(member.employeeFullName)}
            </span>

            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-1 flex-col items-center justify-center px-3 pt-6 text-center">
                    <p className="line-clamp-1 text-sm font-semibold text-[#191c1e]" title={member.employeeFullName}>
                        {member.employeeFullName}
                    </p>
                    <p className="font-mono text-xs text-[#8a8f94]">{member.employeeCode}</p>
                </div>
                <div
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: color }}
                    title={`${unit.code} · ${unit.nameVn}${member.jobTitleNameVn ? `\n${member.jobTitleNameVn}` : ""}`}
                >
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">{unit.nameVn}</span>
                </div>
            </div>

            {reports > 0 && (
                <button
                    type="button"
                    onClick={() => onToggle(person.key)}
                    aria-expanded={expanded}
                    title={expanded ? t("collapseBranch") : t("expandBranch")}
                    className="absolute -bottom-3 left-1/2 z-10 flex h-6 -translate-x-1/2 cursor-pointer items-center gap-0.5 rounded-full border border-[#e0e3e5] bg-white px-1.5 text-xs font-medium tabular-nums text-[#5e3f3a] shadow-sm transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                >
                    {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {reports}
                </button>
            )}
        </div>
    );
}

// One manager and the bus line fanning out to their reports; a longer stem bridges skipped title rows.
function PersonBranch({ person, row, rowOfTitle, collapsedKeys, onToggle }: BranchProps) {
    const showReports = person.children.length > 0 && !collapsedKeys.has(person.key);

    return (
        <div className="flex flex-col items-center">
            <PersonCard person={person} row={row} collapsedKeys={collapsedKeys} onToggle={onToggle} />
            {showReports && (
                <>
                    <div className="h-6 w-px bg-[#c9cdd1]" />
                    <div className="flex">
                        {person.children.map((child, index) => {
                            const childRow = rowOf(child, rowOfTitle, row);
                            const skipped = childRow - row - 1;
                            const isFirst = index === 0;
                            const isLast = index === person.children.length - 1;
                            return (
                                <div key={child.key} className="relative flex flex-col items-center px-2 pt-4">
                                    {person.children.length > 1 && (
                                        <div
                                            className={`absolute top-0 h-px bg-[#c9cdd1] ${
                                                isFirst ? "left-1/2 right-0" : isLast ? "left-0 right-1/2" : "left-0 right-0"
                                            }`}
                                        />
                                    )}
                                    <div className="absolute left-1/2 top-0 h-4 w-px bg-[#c9cdd1]" />
                                    {skipped > 0 && <div className="w-px bg-[#c9cdd1]" style={{ height: skipped * ROW_HEIGHT }} />}
                                    <PersonBranch person={child} row={childRow} rowOfTitle={rowOfTitle} collapsedKeys={collapsedKeys} onToggle={onToggle} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// People chart in job-title bands; the title column stays pinned while the canvas scrolls sideways.
export default function OrgUnitChart({ nodes }: { nodes: OrgUnitTreeDto[] }) {
    const t = useTranslations("Workflow.OrgUnit");
    const [collapsedKeys, setCollapsedKeys] = useState<Set<number>>(new Set());

    const people = buildPeople(nodes, null, []);
    const titles = Array.from(collectTitles(people, new Map()).values()).sort((a, b) => a.rank - b.rank);
    const rowOfTitle = new Map(titles.map((title, index) => [title.jobTitleId ?? -1, index]));
    const rowCount = deepestRow(people, rowOfTitle, collapsedKeys) + 1;
    const rows = Array.from({ length: rowCount }, (_, index) => titles[index]);
    const bandStyle = (index: number): CSSProperties => ({ height: ROW_HEIGHT, backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc" });

    const toggle = (key: number) =>
        setCollapsedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    if (people.length === 0) {
        return <p className="p-6 text-center text-sm text-[#8a8f94]">{t("chartNoPeople")}</p>;
    }

    return (
        <div className="overflow-x-auto">
            <div className="relative flex w-max min-w-full pb-8" style={{ minHeight: rowCount * ROW_HEIGHT + 32 }}>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
                    {rows.map((_, index) => (
                        <div key={index} className="border-b border-[#f1f5f9]" style={bandStyle(index)} />
                    ))}
                </div>

                <div className="sticky left-0 z-20 w-28 shrink-0 border-r border-[#e0e3e5] sm:w-40">
                    {rows.map((title, index) => (
                        <div key={index} className="flex flex-col justify-center gap-1 border-b border-[#f1f5f9] px-3 sm:px-4" style={bandStyle(index)}>
                            {title && (
                                <>
                                    <span className="flex items-center gap-2 text-sm font-semibold text-[#191c1e]">
                                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tierColor(index) }} />
                                        {title.name || t("treeMemberNoJobTitle")}
                                    </span>
                                    <span className="inline-flex items-center gap-1 pl-4 text-xs tabular-nums text-[#5e3f3a]" title={t("memberCountTitle")}>
                                        <Users className="size-3" /> {title.count}
                                    </span>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="relative flex flex-1 items-start justify-center px-4" style={{ paddingTop: CARD_TOP }}>
                    {people.map((person) => {
                        const row = rowOf(person, rowOfTitle, -1);
                        return (
                            <div key={person.key} className="px-2" style={{ paddingTop: row * ROW_HEIGHT }}>
                                <PersonBranch person={person} row={row} rowOfTitle={rowOfTitle} collapsedKeys={collapsedKeys} onToggle={toggle} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
