"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ApprovalDelegationApi } from "@/modules/workflow/api/approval-delegation.api";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import type { ApprovalDelegationDto, CreateUpdateApprovalDelegationDto } from "@/modules/workflow/types/approval-delegation.dto";
import type { AvailableFormDto, MyEmployeeDto } from "@/modules/workflow/types/workflow-request.dto";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import ApprovalDelegationForm, { type ApprovalDelegationFormValues } from "./ApprovalDelegationForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";

function toDateInputValue(iso: string): string {
    return iso.slice(0, 10);
}

// BE always resolves the delegator to the current user; FE only picks the delegate.
export default function ApprovalDelegationList() {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");

    const [delegations, setDelegations] = useState<ApprovalDelegationDto[]>([]);
    const [myEmployee, setMyEmployee] = useState<MyEmployeeDto | null>(null);
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [forms, setForms] = useState<AvailableFormDto[]>([]);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<ApprovalDelegationDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        async () => {
            const [mine, me, employees, availableForms] = await Promise.all([
                ApprovalDelegationApi.getMine(),
                WorkflowRequestApi.getMyEmployee(),
                EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
                WorkflowRequestApi.getAvailableForms(),
            ]);
            return { mine, me, employees: employees.data, availableForms };
        },
        [],
        (result) => {
            setDelegations(result.mine);
            setMyEmployee(result.me);
            setEmployeeOptions(
                result.employees
                    .filter((x) => x.isActive && x.id !== result.me.id)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.employeeCode})`, searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase() }))
            );
            setForms(result.availableForms);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const myDelegations = myEmployee ? delegations.filter((d) => d.delegatorEmployeeId === myEmployee.id) : [];
    const delegatedToMe = myEmployee ? delegations.filter((d) => d.delegateEmployeeId === myEmployee.id) : [];

    const openCreate = () => {
        setFormMode("create");
        setEditingItem(null);
        setFormOpen(true);
    };
    const openEdit = (item: ApprovalDelegationDto) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormOpen(true);
    };
    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmit = async (values: ApprovalDelegationFormValues) => {
        const payload: CreateUpdateApprovalDelegationDto = {
            delegateEmployeeId: values.delegateEmployeeId as number,
            formDefinitionId: values.formDefinitionId === "" ? null : values.formDefinitionId,
            fromDate: `${values.fromDate}T00:00:00`,
            toDate: `${values.toDate}T23:59:59`,
            reason: values.reason.trim() || null,
        };

        setIsSaving(true);
        try {
            if (formMode === "create") {
                await ApprovalDelegationApi.create(payload);
                toast.success(t("createDelegationSuccess"));
            } else if (editingItem) {
                await ApprovalDelegationApi.update(editingItem.id, payload);
                toast.success(t("updateDelegationSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveDelegationError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (deletingId === null) return;
        setIsDeleting(true);
        try {
            await ApprovalDelegationApi.remove(deletingId);
            toast.success(t("deleteDelegationSuccess"));
            setDeletingId(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteDelegationError")));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("delegationTitle")}</h1>
                </div>
                <button
                    onClick={openCreate}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                >
                    <Plus className="h-3.5 w-3.5" /> {t("addDelegation")}
                </button>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("delegationMineTitle")}</h2>
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : myDelegations.length === 0 ? (
                    <EmptyState icon={Users} title={t("noDelegations")} />
                ) : (
                    <div className="space-y-2">
                        {myDelegations.map((d) => (
                            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e0e3e5] p-3">
                                <div>
                                    <p className="text-sm font-semibold text-[#191c1e]">{d.delegateEmployeeName}</p>
                                    <p className="text-xs text-[#8a8f94]">
                                        {toDateInputValue(d.fromDate)} → {toDateInputValue(d.toDate)} · {d.formDefinitionNameVn ?? t("allFormTypes")}
                                        {d.reason && ` · ${d.reason}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => openEdit(d)} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40" title={tCommon("edit")} aria-label={tCommon("edit")}><Pencil className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setDeletingId(d.id)} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e9bcb6] text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-40" title={tCommon("delete")} aria-label={tCommon("delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("delegatedToMeTitle")}</h2>
                {isLoading ? (
                    <Skeleton className="h-14 w-full" />
                ) : delegatedToMe.length === 0 ? (
                    <EmptyState icon={Users} title={t("noDelegations")} />
                ) : (
                    <div className="space-y-2">
                        {delegatedToMe.map((d) => (
                            <div key={d.id} className="rounded-lg border border-[#e0e3e5] p-3">
                                <p className="text-sm font-semibold text-[#191c1e]">{d.delegatorEmployeeName}</p>
                                <p className="text-xs text-[#8a8f94]">
                                    {toDateInputValue(d.fromDate)} → {toDateInputValue(d.toDate)} · {d.formDefinitionNameVn ?? t("allFormTypes")}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <ApprovalDelegationForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                employeeOptions={employeeOptions}
                forms={forms}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmit}
            />

            <ConfirmDialog
                isOpen={deletingId !== null}
                title={t("deleteDelegationTitle")}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingId(null);
                }}
            />
        </div>
    );
}
