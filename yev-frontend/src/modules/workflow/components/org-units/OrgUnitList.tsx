"use client";

import { useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    RefreshCw,
    Plus,
    Pencil,
    Trash2,
    UserPlus,
    ChevronRight,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    GripVertical,
    Building2,
    Landmark,
    Factory,
    Briefcase,
    UsersRound,
    Users,
    Search,
    X,
    type LucideIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import type { OrgUnitDto, OrgUnitTreeDto, OrgUnitTreeMemberDto } from "@/modules/workflow/types/org-unit.dto";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import OrgUnitForm, { type OrgUnitFormValues, type FlatOrgUnitOption } from "./OrgUnitForm";
import AssignEmployeeDialog from "./AssignEmployeeDialog";
import OrgUnitMemberTree from "./OrgUnitMemberTree";
import OrgUnitDetailPanel from "./OrgUnitDetailPanel";
import OrgUnitChart, { type LevelInfo } from "./OrgUnitChart";
import { Tabs } from "@/components/ui/Tabs";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

// excludeId drops the node and its subtree, since picking a descendant as parent would create a cycle.
function flattenTree(nodes: OrgUnitTreeDto[], depth = 0, excludeId?: number | null): FlatOrgUnitOption[] {
    const result: FlatOrgUnitOption[] = [];
    for (const node of nodes) {
        if (node.id === excludeId) continue;
        result.push({ id: node.id, label: `${"— ".repeat(depth)}${node.code} · ${node.nameVn}` });
        result.push(...flattenTree(node.children, depth + 1, excludeId));
    }
    return result;
}

// Lower-case, accent-free form used for matching, so "xuong di an" matches the accented name.
function normalizeText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();
}

// Keeps the nodes whose own fields match (whole subtree kept) or that hold a matching member / descendant.
function filterTree(nodes: OrgUnitTreeDto[], keyword: string): OrgUnitTreeDto[] {
    const result: OrgUnitTreeDto[] = [];
    for (const node of nodes) {
        const selfMatch = [node.code, node.nameVn, node.nameJp ?? ""].some((value) => normalizeText(value).includes(keyword));
        if (selfMatch) {
            result.push(node);
            continue;
        }
        const members = node.members.filter((member) =>
            [member.employeeFullName, member.employeeCode, member.jobTitleNameVn ?? ""].some((value) => normalizeText(value).includes(keyword))
        );
        const children = filterTree(node.children, keyword);
        if (members.length > 0 || children.length > 0) result.push({ ...node, members, children });
    }
    return result;
}

// Collects every node that has a body to fold (members or children) and the distinct members.
function summarizeTree(nodes: OrgUnitTreeDto[], foldableIds: number[], employeeIds: Set<number>) {
    for (const node of nodes) {
        if (node.children.length > 0 || node.members.length > 0) foldableIds.push(node.id);
        for (const member of node.members) employeeIds.add(member.employeeId);
        summarizeTree(node.children, foldableIds, employeeIds);
    }
}

function countUnits(nodes: OrgUnitTreeDto[]): number {
    return nodes.reduce((sum, node) => sum + 1 + countUnits(node.children), 0);
}

type DragData =
    | { kind: "member"; member: OrgUnitTreeMemberDto; fromUnitId: number }
    | { kind: "unit"; unit: OrgUnitTreeDto };
type DropData = { kind: "unit"; unitId: number } | { kind: "root" };

function findNode(nodes: OrgUnitTreeDto[], id: number): OrgUnitTreeDto | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
    }
    return null;
}

function buildParentMap(nodes: OrgUnitTreeDto[], parent: OrgUnitTreeDto | null = null, map = new Map<number, OrgUnitTreeDto | null>()) {
    for (const node of nodes) {
        map.set(node.id, parent);
        buildParentMap(node.children, node, map);
    }
    return map;
}

// True when `id` is the node itself or any descendant of it.
function subtreeContains(node: OrgUnitTreeDto, id: number): boolean {
    return node.id === id || node.children.some((child) => subtreeContains(child, id));
}

function nextSortOrder(siblings: OrgUnitTreeDto[]) {
    return siblings.reduce((max, sibling) => Math.max(max, sibling.sortOrder), -1) + 1;
}

function RootDropZone({ label }: { label: string }) {
    const { setNodeRef, isOver } = useDroppable({ id: "drop-root", data: { kind: "root" } satisfies DropData });
    return (
        <div
            ref={setNodeRef}
            className={`mb-2 rounded-lg border border-dashed px-3 py-2 text-center text-xs transition-colors ${
                isOver ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]" : "border-[#c9cdd1] text-[#8a8f94]"
            }`}
        >
            {label}
        </div>
    );
}

// One icon per org level, from the top level down; deeper levels reuse the last icon.
const LEVEL_ICONS: LucideIcon[] = [Landmark, Factory, Briefcase, UsersRound];

const rowActionClassName =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e]";

interface TreeNodeProps {
    node: OrgUnitTreeDto;
    levels: Map<number, LevelInfo>;
    collapsedIds: Set<number>;
    canManage: boolean;
    selectedId: number | null;
    onSelect: (id: number) => void;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onAssignMember: (node: OrgUnitTreeDto) => void;
    onEdit: (id: number) => void;
    onDelete: (node: OrgUnitTreeDto) => void;
}

// Flat tree: units are bold rows with a square level icon, people are lighter rows with a round avatar,
// and a thin guide line connects every level to its parent.
function TreeNode({ node, levels, collapsedIds, canManage, selectedId, onSelect, onToggle, onAddChild, onAssignMember, onEdit, onDelete }: TreeNodeProps) {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");
    const hasMembers = node.members.length > 0;
    const hasChildren = node.children.length > 0;
    const hasBody = hasMembers || hasChildren;
    const expanded = !collapsedIds.has(node.id);
    const level = levels.get(node.orgLevelId);
    const LevelIcon = level?.icon ?? Building2;
    const isSelected = selectedId === node.id;

    const {
        setNodeRef: setDragRef,
        setActivatorNodeRef,
        listeners,
        attributes,
        isDragging,
    } = useDraggable({ id: `unit-${node.id}`, data: { kind: "unit", unit: node } satisfies DragData, disabled: !canManage });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop-${node.id}`, data: { kind: "unit", unitId: node.id } satisfies DropData });

    return (
        <div>
            <div
                ref={(element) => {
                    setDragRef(element);
                    setDropRef(element);
                }}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                    isSelected ? "bg-[#f2f4f6]" : "hover:bg-[#f8fafc]"
                } ${isOver ? "ring-2 ring-[#e3000f]" : ""} ${isDragging ? "opacity-40" : ""}`}
            >
                {canManage && (
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        {...listeners}
                        {...attributes}
                        title={t("dragHandleUnit")}
                        aria-label={t("dragHandleUnit")}
                        className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[#8a8f94] opacity-0 transition hover:bg-[#eceef0] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                        <GripVertical className="size-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onToggle(node.id)}
                    disabled={!hasBody}
                    aria-expanded={hasBody ? expanded : undefined}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#eceef0] hover:text-[#191c1e] disabled:pointer-events-none disabled:opacity-0"
                >
                    {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>

                <span
                    title={level?.name}
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                        level?.isTop ? "bg-[#fff4f2] text-[#e3000f]" : "bg-[#f2f4f6] text-[#5e3f3a]"
                    }`}
                >
                    <LevelIcon className="size-4" />
                </span>

                <button type="button" onClick={() => onSelect(node.id)} className="min-w-0 cursor-pointer truncate text-left text-sm">
                    <span className="font-semibold text-[#191c1e]">{node.nameVn}</span>
                    {node.nameJp && <span className="ml-2 text-xs text-[#5e3f3a]">{node.nameJp}</span>}
                </button>

                <span className="hidden shrink-0 font-mono text-xs text-[#8a8f94] sm:inline">{node.code}</span>
                {hasMembers && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-[#5e3f3a]" title={t("memberCountTitle")}>
                        <Users className="size-3.5" /> {node.members.length}
                    </span>
                )}

                <span className="flex-1" />

                {canManage && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <button type="button" onClick={() => onAddChild(node.id)} title={t("actionAddChild")} aria-label={t("actionAddChild")} className={rowActionClassName}>
                            <Plus className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => onAssignMember(node)} title={t("actionAssignMember")} aria-label={t("actionAssignMember")} className={rowActionClassName}>
                            <UserPlus className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => onEdit(node.id)} title={tCommon("edit")} aria-label={tCommon("edit")} className={rowActionClassName}>
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

            {hasBody && expanded && (
                <div className="ml-5 border-l border-[#e0e3e5] pl-3">
                    <OrgUnitMemberTree members={node.members} orgUnitId={node.id} draggable={canManage} />
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            levels={levels}
                            collapsedIds={collapsedIds}
                            canManage={canManage}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onToggle={onToggle}
                            onAddChild={onAddChild}
                            onAssignMember={onAssignMember}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OrgUnitList() {
    const t = useTranslations("Workflow.OrgUnit");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.Organization.Manage");

    const [tree, setTree] = useState<OrgUnitTreeDto[]>([]);
    const [orgLevels, setOrgLevels] = useState<OrgLevelDto[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dragging, setDragging] = useState<DragData | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<OrgUnitDto | null>(null);
    const [defaultParentId, setDefaultParentId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const [deletingItem, setDeletingItem] = useState<OrgUnitTreeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [assigningFor, setAssigningFor] = useState<OrgUnitTreeDto | null>(null);

    // Every node starts expanded; only the folded ones are tracked.
    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState("");
    const [view, setView] = useState<"list" | "chart">("list");

    const { isLoading, error, refetch: fetchAll } = useFetchEffect(
        async () => {
            const [treeResult, levelsResult, titlesResult] = await Promise.all([
                OrgUnitApi.getOrgUnitTree(),
                OrgLevelApi.getAllOrgLevels(),
                JobTitleApi.getAllJobTitles(),
            ]);
            return { tree: treeResult, levels: levelsResult, titles: titlesResult };
        },
        [],
        (result) => {
            setTree(result.tree);
            setOrgLevels(result.levels);
            setJobTitles(result.titles);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const openCreateForm = (parentId: number | null) => {
        setFormMode("create");
        setEditingItem(null);
        setDefaultParentId(parentId);
        setFormOpen(true);
    };

    const openEditForm = async (id: number) => {
        setIsLoadingDetail(true);
        try {
            const detail = await OrgUnitApi.getOrgUnitById(id);
            setFormMode("edit");
            setEditingItem(detail);
            setDefaultParentId(detail.parentId);
            setFormOpen(true);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("loadDetailError")));
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmitForm = async (values: OrgUnitFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await OrgUnitApi.createOrgUnit({ ...values, validFrom: null, validTo: null });
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                await OrgUnitApi.updateOrgUnit(editingItem.id, {
                    ...values,
                    validFrom: editingItem.validFrom,
                    validTo: editingItem.validTo,
                });
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await fetchAll();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            await OrgUnitApi.deleteOrgUnit(deletingItem.id);
            toast.success(t("deleteSuccess"));
            setDeletingItem(null);
            await fetchAll();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    const parentOptions = flattenTree(tree, 0, editingItem?.id ?? null);
    const parentMap = buildParentMap(tree);
    const selectedNode = selectedId !== null ? findNode(tree, selectedId) : null;

    // New child defaults to the level right below its parent and to the end of its siblings.
    const createDefaultParent = defaultParentId !== null ? findNode(tree, defaultParentId) : null;
    const sortedLevels = orgLevels.slice().sort((a, b) => a.levelNumber - b.levelNumber);
    const parentLevel = createDefaultParent ? orgLevels.find((level) => level.id === createDefaultParent.orgLevelId) : undefined;
    const createDefaultLevelId = parentLevel
        ? (sortedLevels.find((level) => level.levelNumber > parentLevel.levelNumber) ?? parentLevel).id
        : (sortedLevels[0]?.id ?? null);
    const createDefaultSortOrder = nextSortOrder(createDefaultParent ? createDefaultParent.children : tree);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragStart = (event: DragStartEvent) => {
        setDragging((event.active.data.current as DragData | undefined) ?? null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setDragging(null);
        const source = event.active.data.current as DragData | undefined;
        const target = event.over?.data.current as DropData | undefined;
        if (!source || !target) return;

        if (source.kind === "member" && target.kind === "unit") {
            if (target.unitId === source.fromUnitId) return;
            try {
                await EmployeeApi.updateEmployeeOrgUnit(source.member.assignmentId, {
                    orgUnitId: target.unitId,
                    jobTitleId: source.member.jobTitleId,
                    isPrimary: source.member.isPrimary,
                    validFrom: null,
                    validTo: null,
                });
                toast.success(t("moveMemberSuccess"));
                await fetchAll();
            } catch (err) {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("moveMemberError")));
            }
            return;
        }

        if (source.kind === "unit") {
            const newParentId = target.kind === "unit" ? target.unitId : null;
            const currentParentId = parentMap.get(source.unit.id)?.id ?? null;
            if (newParentId === currentParentId) return;
            if (newParentId !== null && subtreeContains(source.unit, newParentId)) {
                toast.error(t("moveUnitInvalid"));
                return;
            }
            const siblings = newParentId === null ? tree : (findNode(tree, newParentId)?.children ?? []);
            try {
                await OrgUnitApi.reorderOrgUnits([{ id: source.unit.id, parentId: newParentId, sortOrder: nextSortOrder(siblings) }]);
                toast.success(t("moveUnitSuccess"));
                await fetchAll();
            } catch (err) {
                console.error(err);
                toast.error(getApiErrorMessage(err, t("moveUnitError")));
            }
        }
    };

    const levels = new Map<number, LevelInfo>(
        orgLevels
            .slice()
            .sort((a, b) => a.levelNumber - b.levelNumber)
            .map((level, index) => [
                level.id,
                { name: level.nameVn, icon: LEVEL_ICONS[Math.min(index, LEVEL_ICONS.length - 1)], isTop: index === 0 },
            ])
    );

    // While searching, every branch is forced open so matches are never hidden inside a folded node.
    const keyword = normalizeText(search.trim());
    const isSearching = keyword !== "";
    const visibleTree = isSearching ? filterTree(tree, keyword) : tree;
    const effectiveCollapsedIds = isSearching ? new Set<number>() : collapsedIds;

    const foldableIds: number[] = [];
    const employeeIds = new Set<number>();
    summarizeTree(tree, foldableIds, new Set());
    summarizeTree(visibleTree, [], employeeIds);

    const toggleNode = (id: number) =>
        setCollapsedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchAll()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    {canManage && (
                        <button
                            onClick={() => openCreateForm(null)}
                            disabled={orgLevels.length === 0}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                        >
                            <Plus className="h-3.5 w-3.5" /> {t("addRoot")}
                        </button>
                    )}
                </div>
            </div>

            {orgLevels.length === 0 && !isLoading && (
                <div className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                    {t("noOrgLevelWarning")}
                </div>
            )}

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(null)}>
            <div className={view === "list" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start" : ""}>
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                {tree.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a8f94]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t("searchPlaceholder")}
                                    aria-label={t("searchPlaceholder")}
                                    className="h-8 w-64 rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                                {isSearching && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch("")}
                                        aria-label={t("clearSearch")}
                                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[#5e3f3a] transition hover:bg-[#eceef0] hover:text-[#191c1e]"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-sm tabular-nums text-[#5e3f3a]">
                                {t("treeSummary", { units: countUnits(visibleTree), members: employeeIds.size })}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Tabs
                                tabs={[
                                    { key: "list", label: t("viewList") },
                                    { key: "chart", label: t("viewChart") },
                                ]}
                                activeKey={view}
                                onChange={setView}
                            />
                            <button
                                type="button"
                                onClick={() => setCollapsedIds(new Set(foldableIds))}
                                disabled={isSearching || foldableIds.length === 0}
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#e6e9ec] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronsDownUp className="h-3.5 w-3.5" /> {t("collapseAll")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setCollapsedIds(new Set())}
                                disabled={isSearching || collapsedIds.size === 0}
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#e6e9ec] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronsUpDown className="h-3.5 w-3.5" /> {t("expandAll")}
                            </button>
                        </div>
                    </div>
                )}

                <div className={view === "list" ? "p-3" : ""}>
                    {view === "list" && dragging?.kind === "unit" && <RootDropZone label={t("dropRoot")} />}
                    {isLoading && tree.length === 0 && (
                        <div className="space-y-2 p-5">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    )}
                    {!isLoading && tree.length === 0 && <EmptyState icon={Building2} title={t("noData")} />}
                    {!isLoading && tree.length > 0 && visibleTree.length === 0 && <EmptyState icon={Search} title={t("noSearchResult")} />}
                    {view === "list" &&
                        visibleTree.map((node) => (
                            <TreeNode
                                key={node.id}
                                node={node}
                                levels={levels}
                                collapsedIds={effectiveCollapsedIds}
                                canManage={canManage}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onToggle={toggleNode}
                                onAddChild={(parentId) => openCreateForm(parentId)}
                                onAssignMember={(n) => setAssigningFor(n)}
                                onEdit={(id) => openEditForm(id)}
                                onDelete={(n) => setDeletingItem(n)}
                            />
                        ))}
                    {view === "chart" && visibleTree.length > 0 && (
                        <OrgUnitChart
                            nodes={visibleTree}
                            levels={levels}
                            collapsedIds={effectiveCollapsedIds}
                            canManage={canManage}
                            onToggle={toggleNode}
                            onAddChild={(parentId) => openCreateForm(parentId)}
                            onAssignMember={(n) => setAssigningFor(n)}
                            onEdit={(id) => openEditForm(id)}
                            onDelete={(n) => setDeletingItem(n)}
                        />
                    )}
                </div>
            </section>

            {view === "list" && (
                <aside className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm lg:sticky lg:top-4">
                    {selectedNode ? (
                        <OrgUnitDetailPanel
                            key={selectedNode.id}
                            node={selectedNode}
                            levelName={levels.get(selectedNode.orgLevelId)?.name}
                            parentName={parentMap.get(selectedNode.id)?.nameVn ?? null}
                            jobTitles={jobTitles}
                            canManage={canManage}
                            onSelect={setSelectedId}
                            onAddChild={(parentId) => openCreateForm(parentId)}
                            onAssignMember={(n) => setAssigningFor(n)}
                            onEdit={(id) => openEditForm(id)}
                            onDelete={(n) => setDeletingItem(n)}
                            onChanged={() => fetchAll()}
                        />
                    ) : (
                        <EmptyState icon={Building2} title={t("detailEmpty")} />
                    )}
                </aside>
            )}
            </div>
            <DragOverlay>
                {dragging && (
                    <div className="rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-sm font-medium text-[#191c1e] shadow-lg">
                        {dragging.kind === "member" ? dragging.member.employeeFullName : dragging.unit.nameVn}
                    </div>
                )}
            </DragOverlay>
            </DndContext>

            <OrgUnitForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                defaultParentId={defaultParentId}
                defaultOrgLevelId={formMode === "create" ? createDefaultLevelId : null}
                defaultSortOrder={formMode === "create" ? createDefaultSortOrder : 0}
                orgLevels={orgLevels}
                parentOptions={parentOptions}
                loading={isSaving || isLoadingDetail}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingItem !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingItem?.nameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingItem(null);
                }}
            />

            {assigningFor && (
                <AssignEmployeeDialog
                    orgUnit={{ id: assigningFor.id, code: assigningFor.code, nameVn: assigningFor.nameVn, orgLevelId: assigningFor.orgLevelId }}
                    onClose={() => setAssigningFor(null)}
                    onSaved={() => fetchAll()}
                />
            )}
        </div>
    );
}
