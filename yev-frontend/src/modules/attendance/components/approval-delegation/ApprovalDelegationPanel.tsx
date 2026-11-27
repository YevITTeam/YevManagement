"use client";

import { useState } from "react";
import { ArrowRight, History, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { ApprovalDelegationApi } from "@/modules/attendance/api/approval-delegation.api";
import type { ApprovalDelegationDto, CreateUpdateApprovalDelegationDto } from "@/modules/attendance/types/approval-delegation.dto";
import type { SelectOption } from "@/components/ui/SearchableSelect";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { IconButton, ToggleChip } from "@/components/ui/ListToolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import ApprovalDelegationForm, { type ApprovalDelegationFormValues } from "./ApprovalDelegationForm";

type DelegationState = "active" | "upcoming" | "expired";

const stateOrder: Record<DelegationState, number> = { active: 0, upcoming: 1, expired: 2 };

const stateBadgeClassName: Record<DelegationState, string> = {
    active: "bg-emerald-50 text-emerald-600",
    upcoming: "bg-[#fff4e5] text-[#9a5b00]",
    expired: "bg-[#f2f4f6] text-[#8a8f94]",
};

// Dates are plain yyyy-MM-dd strings, so they compare lexically; today is the viewer's local day.
function getState(item: ApprovalDelegationDto, today: string): DelegationState {
    if (item.toDate < today) return "expired";
    if (item.fromDate > today) return "upcoming";
    return "active";
}

function formatDay(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function daysBetween(from: string, to: string) {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function getInitial(name: string) {
    const parts = name.replace(/\[.*?\]/g, "").trim().split(/\s+/);
    return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
}

export default function ApprovalDelegationPanel() {
    const t = useTranslations("Attendance.ApprovalDelegation");
    const tCommon = useTranslations("Common");

    const [delegations, setDelegations] = useState<ApprovalDelegationDto[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<ApprovalDelegationDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showExpired, setShowExpired] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        async () => {
            const [mine, options] = await Promise.all([ApprovalDelegationApi.getMine(), ApprovalDelegationApi.getDelegateOptions()]);
            return { mine, options };
        },
        [],
        (result) => {
            setDelegations(result.mine);
            setEmployeeOptions(
                result.options.map((x) => ({
                    value: x.employeeId,
                    label: `${x.fullName} (${x.code}) · ${x.jobTitleName}`,
                    searchText: `${x.code} ${x.fullName} ${x.userName}`.toLowerCase(),
                }))
            );
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const today = new Date().toLocaleDateString("sv-SE");
    const sorted = [...delegations].sort(
        (a, b) => stateOrder[getState(a, today)] - stateOrder[getState(b, today)] || b.fromDate.localeCompare(a.fromDate)
    );
    const expiredCount = sorted.filter((d) => getState(d, today) === "expired").length;
    const visible = showExpired ? sorted : sorted.filter((d) => getState(d, today) !== "expired");
    const given = visible.filter((d) => d.isMine);
    const received = visible.filter((d) => !d.isMine);

    const openForm = (mode: "create" | "edit", item: ApprovalDelegationDto | null) => {
        setFormMode(mode);
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
            fromDate: values.fromDate,
            toDate: values.toDate,
            reason: values.reason.trim() || null,
        };

        setIsSaving(true);
        try {
            if (formMode === "create") {
                await ApprovalDelegationApi.create(payload);
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                await ApprovalDelegationApi.update(editingItem.id, payload);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (deletingId === null) return;
        setIsDeleting(true);
        try {
            await ApprovalDelegationApi.remove(deletingId);
            toast.success(t("deleteSuccess"));
            setDeletingId(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    const stateLabel = (item: ApprovalDelegationDto, state: DelegationState) => {
        if (state === "active") return t("daysLeft", { count: daysBetween(today, item.toDate) + 1 });
        if (state === "upcoming") return t("startsOn", { date: formatDay(item.fromDate) });
        return t("expired");
    };

    const renderRow = (item: ApprovalDelegationDto, personName: string) => {
        const state = getState(item, today);
        return (
            <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border border-[#e0e3e5] bg-white p-3 ${state === "expired" ? "opacity-60" : ""}`}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4f2] text-sm font-semibold text-[#e3000f]">
                    {getInitial(personName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[#191c1e]">{personName}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateBadgeClassName[state]}`}>{stateLabel(item, state)}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#5e3f3a]">
                        {formatDay(item.fromDate)}
                        <ArrowRight className="h-3 w-3 text-[#8a8f94]" aria-hidden />
                        {formatDay(item.toDate)}
                    </p>
                    {item.reason && <p className="mt-0.5 truncate text-xs text-[#8a8f94]" title={item.reason}>{item.reason}</p>}
                </div>
                {item.isMine && state !== "expired" && (
                    <div className="flex shrink-0 items-center gap-1">
                        <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openForm("edit", item)} size="sm" variant="ghost" />
                        <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingId(item.id)} size="sm" variant="danger" />
                    </div>
                )}
            </div>
        );
    };

    const renderSection = (title: string, items: ApprovalDelegationDto[], nameOf: (d: ApprovalDelegationDto) => string) => (
        <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5e3f3a]">
                    {title} <span className="ml-1 text-[#8a8f94]">{items.length}</span>
                </h2>
            </div>
            <div className="space-y-2 p-3">
                {isLoading ? (
                    <Skeleton className="h-16 w-full" />
                ) : items.length > 0 ? (
                    items.map((d) => renderRow(d, nameOf(d)))
                ) : (
                    <EmptyState icon={Inbox} title={t("empty")} />
                )}
            </div>
        </section>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <h1 className="mr-auto text-xl font-semibold text-[#191c1e]">{t("title")}</h1>
                {expiredCount > 0 && (
                    <ToggleChip checked={showExpired} onChange={setShowExpired} icon={History} label={`${t("expired")} (${expiredCount})`} />
                )}
                <button
                    onClick={() => openForm("create", null)}
                    title={t("add")}
                    aria-label={t("add")}
                    className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#e3000f] px-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009] sm:px-3"
                >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{tCommon("add")}</span>
                </button>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                {renderSection(t("mineTitle"), given, (d) => d.delegateName)}
                {renderSection(t("toMeTitle"), received, (d) => d.delegatorName)}
            </div>

            <ApprovalDelegationForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                employeeOptions={employeeOptions}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmit}
            />

            <ConfirmDialog
                isOpen={deletingId !== null}
                title={t("deleteTitle")}
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
