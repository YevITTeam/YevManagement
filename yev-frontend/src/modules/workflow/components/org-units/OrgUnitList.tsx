"use client";

import { useState } from "react";
import { RefreshCw, Plus, Pencil, Trash2, UserPlus, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import type { OrgUnitDto, OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import OrgUnitForm, { type OrgUnitFormValues, type FlatOrgUnitOption } from "./OrgUnitForm";
import AssignEmployeeDialog from "./AssignEmployeeDialog";
import OrgUnitMemberTree from "./OrgUnitMemberTree";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

// Flatten cây -> option cho select "Đơn vị cha", label thụt lề theo độ sâu. excludeId dùng khi sửa
// 1 node để nó không tự chọn chính mình làm cha (BE vẫn tự chặn vòng lặp sâu hơn ở Service).
function flattenTree(nodes: OrgUnitTreeDto[], depth = 0, excludeId?: number | null): FlatOrgUnitOption[] {
    const result: FlatOrgUnitOption[] = [];
    for (const node of nodes) {
        if (node.id !== excludeId) {
            result.push({ id: node.id, label: `${"— ".repeat(depth)}${node.code} · ${node.nameVn}` });
        }
        result.push(...flattenTree(node.children, depth + 1, excludeId));
    }
    return result;
}

interface TreeNodeProps {
    node: OrgUnitTreeDto;
    depth: number;
    canManage: boolean;
    onAddChild: (parentId: number) => void;
    onAssignMember: (node: OrgUnitTreeDto) => void;
    onEdit: (id: number) => void;
    onDelete: (node: OrgUnitTreeDto) => void;
}

function TreeNode({ node, depth, canManage, onAddChild, onAssignMember, onEdit, onDelete }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children.length > 0;

    return (
        <div>
            <div
                className="group flex items-center gap-2 rounded-lg py-2 pr-3 hover:bg-[#f8fafc]"
                style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
            >
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    disabled={!hasChildren}
                    className="flex h-5 w-5 shrink-0 items-center justify-center text-[#5e3f3a] disabled:opacity-0"
                >
                    {hasChildren && (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                </button>

                <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold text-[#191c1e]">{node.nameVn}</span>
                    <span className="ml-2 text-xs text-[#8a8f94]">{node.code}</span>
                    {node.nameJp && <span className="ml-2 text-xs text-[#5e3f3a]">({node.nameJp})</span>}
                </span>

                {canManage && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                            type="button"
                            onClick={() => onAddChild(node.id)}
                            title="Thêm đơn vị con"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onAssignMember(node)}
                            title="Gán nhân sự"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onEdit(node.id)}
                            title="Sửa"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(node)}
                            title="Xoá"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#930006] hover:bg-[#fff4f2]"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            <OrgUnitMemberTree members={node.members} baseIndentRem={depth * 1.5 + 2.25} />

            {hasChildren && expanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            canManage={canManage}
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

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<OrgUnitDto | null>(null);
    const [defaultParentId, setDefaultParentId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const [deletingItem, setDeletingItem] = useState<OrgUnitTreeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [assigningFor, setAssigningFor] = useState<OrgUnitTreeDto | null>(null);

    const { isLoading, error, refetch: fetchAll } = useFetchEffect(
        async () => {
            const [treeResult, levelsResult] = await Promise.all([OrgUnitApi.getOrgUnitTree(), OrgLevelApi.getAllOrgLevels()]);
            return { tree: treeResult, levels: levelsResult };
        },
        [],
        (result) => {
            setTree(result.tree);
            setOrgLevels(result.levels);
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

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
                </div>

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
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                        >
                            + {t("addRoot")}
                        </button>
                    )}
                </div>
            </div>

            {orgLevels.length === 0 && !isLoading && (
                <div className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                    {t("noOrgLevelWarning")}
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="p-3">
                    {!isLoading && tree.length === 0 && (
                        <div className="px-6 py-8 text-center text-sm text-[#5e3f3a]">{t("noData")}</div>
                    )}
                    {tree.map((node) => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            depth={0}
                            canManage={canManage}
                            onAddChild={(parentId) => openCreateForm(parentId)}
                            onAssignMember={(n) => setAssigningFor(n)}
                            onEdit={(id) => openEditForm(id)}
                            onDelete={(n) => setDeletingItem(n)}
                        />
                    ))}
                </div>
            </section>

            <OrgUnitForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                defaultParentId={defaultParentId}
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
                />
            )}
        </div>
    );
}
