"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ApprovalDelegationApi } from "@/modules/workflow/api/approval-delegation.api";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import type { ApprovalDelegationDto, CreateUpdateApprovalDelegationDto } from "@/modules/workflow/types/approval-delegation.dto";
import type { AvailableFormDto, MyEmployeeDto } from "@/modules/workflow/types/workflow-request.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { getApiErrorMessage } from "@/lib/apiError";

function toDateInputValue(iso: string): string {
    return iso.slice(0, 10);
}

const emptyForm = { delegateEmployeeId: "" as number | "", formDefinitionId: "" as number | "", fromDate: "", toDate: "", reason: "" };

// Ủy quyền duyệt thay (代理承認) — workflow-module.md §3.4/§5.6. DelegatorEmployeeId luôn resolve =
// người dùng hiện tại ở BE, FE chỉ chọn DelegateEmployeeId (mirror comment ở CreateUpdateApprovalDelegationDto).
export default function ApprovalDelegationList() {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");

    const [delegations, setDelegations] = useState<ApprovalDelegationDto[]>([]);
    const [myEmployee, setMyEmployee] = useState<MyEmployeeDto | null>(null);
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [forms, setForms] = useState<AvailableFormDto[]>([]);

    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [values, setValues] = useState(emptyForm);
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

    useDialogReset(formOpen, editingId, () => {
        if (editingId === null) {
            setValues(emptyForm);
            return;
        }
        const item = delegations.find((d) => d.id === editingId);
        if (item) {
            setValues({
                delegateEmployeeId: item.delegateEmployeeId,
                formDefinitionId: item.formDefinitionId ?? "",
                fromDate: toDateInputValue(item.fromDate),
                toDate: toDateInputValue(item.toDate),
                reason: item.reason ?? "",
            });
        }
    });

    const myDelegations = myEmployee ? delegations.filter((d) => d.delegatorEmployeeId === myEmployee.id) : [];
    const delegatedToMe = myEmployee ? delegations.filter((d) => d.delegateEmployeeId === myEmployee.id) : [];

    const openCreate = () => {
        setEditingId(null);
        setFormOpen(true);
    };
    const openEdit = (item: ApprovalDelegationDto) => {
        setEditingId(item.id);
        setFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (values.delegateEmployeeId === "" || !values.fromDate || !values.toDate) return;

        const payload: CreateUpdateApprovalDelegationDto = {
            delegateEmployeeId: values.delegateEmployeeId,
            formDefinitionId: values.formDefinitionId === "" ? null : values.formDefinitionId,
            fromDate: `${values.fromDate}T00:00:00`,
            toDate: `${values.toDate}T23:59:59`,
            reason: values.reason.trim() || null,
        };

        setIsSaving(true);
        try {
            if (editingId === null) {
                await ApprovalDelegationApi.create(payload);
                toast.success(t("createDelegationSuccess"));
            } else {
                await ApprovalDelegationApi.update(editingId, payload);
                toast.success(t("updateDelegationSuccess"));
            }
            setFormOpen(false);
            setEditingId(null);
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
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("delegationDescription")}</p>
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
                    <p className="text-sm text-[#5e3f3a]">{tCommon("loading")}</p>
                ) : myDelegations.length === 0 ? (
                    <p className="text-sm text-[#8a8f94]">{t("noDelegations")}</p>
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
                                <div className="flex items-center gap-3">
                                    <button onClick={() => openEdit(d)} className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#5e3f3a] hover:text-[#191c1e]">
                                        <Pencil className="h-3.5 w-3.5" /> {tCommon("edit")}
                                    </button>
                                    <button onClick={() => setDeletingId(d.id)} className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#930006] hover:text-[#e3000f]">
                                        <Trash2 className="h-3.5 w-3.5" /> {tCommon("delete")}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("delegatedToMeTitle")}</h2>
                {delegatedToMe.length === 0 ? (
                    <p className="text-sm text-[#8a8f94]">{t("noDelegations")}</p>
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

            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && setFormOpen(false)} />
                    <form onSubmit={handleSubmit} className="z-60 mx-4 w-full max-w-md space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-[#191c1e]">{editingId === null ? t("addDelegation") : t("editDelegation")}</h3>

                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("delegateEmployeeLabel")}</span>
                            <SearchableSelect
                                options={employeeOptions}
                                value={values.delegateEmployeeId}
                                onChange={(v) => setValues((c) => ({ ...c, delegateEmployeeId: v }))}
                                placeholder={t("selectPlaceholder")}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("delegationFormLabel")}</span>
                            <select
                                value={values.formDefinitionId}
                                onChange={(e) => setValues((c) => ({ ...c, formDefinitionId: e.target.value === "" ? "" : Number(e.target.value) }))}
                                className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                            >
                                <option value="">{t("allFormTypes")}</option>
                                {forms.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.nameVn}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("fromDateLabel")}</span>
                                <input
                                    type="date"
                                    required
                                    value={values.fromDate}
                                    onChange={(e) => setValues((c) => ({ ...c, fromDate: e.target.value }))}
                                    className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("toDateLabel")}</span>
                                <input
                                    type="date"
                                    required
                                    value={values.toDate}
                                    onChange={(e) => setValues((c) => ({ ...c, toDate: e.target.value }))}
                                    className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("reasonLabel")}</span>
                            <input
                                value={values.reason}
                                onChange={(e) => setValues((c) => ({ ...c, reason: e.target.value }))}
                                className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                            />
                        </label>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => !isSaving && setFormOpen(false)}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] hover:bg-[#f2f4f6]"
                            >
                                {tCommon("cancel")}
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b40009] disabled:opacity-50"
                            >
                                {isSaving ? tCommon("processing") : tCommon("save")}
                            </button>
                        </div>
                    </form>
                </div>
            )}

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
