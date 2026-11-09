"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import { InventoryAssignmentApi } from "@/modules/pc-management/api/inventory-assignment.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { InventoryAssignmentDto } from "@/modules/pc-management/types/inventory.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import { Link } from "@/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

const SCAN_ROLE_NAME = "Kiểm kê thiết bị";

const selectClass =
    "h-10 min-w-[14rem] rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

// Unlike server check, many users may share one branch; re-picking an assigned user changes their branch (BE upserts by userId).
export default function InventoryAssignmentPage() {
    const t = useTranslations("Asset.Inventory");

    const [assignments, setAssignments] = useState<InventoryAssignmentDto[]>([]);
    const [users, setUsers] = useState<UserDto[]>([]);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [userId, setUserId] = useState<number | "">("");
    const [branchId, setBranchId] = useState<number | "">("");
    const [isSaving, setIsSaving] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);

    const { isLoading, refetch } = useFetchEffect(
        () => Promise.all([InventoryAssignmentApi.getAll(), AuthApi.getAllUsersWithRoles(), BranchApi.getAllBranches()]),
        [],
        ([assignmentResult, userResult, branchResult]) => {
            setAssignments(assignmentResult);
            setUsers(userResult);
            setBranches(branchResult);
        },
        t("assignmentLoadError"),
        (message) => toast.error(message)
    );

    const handleSave = async () => {
        const user = users.find((u) => u.id === userId);
        if (!user || branchId === "") return;

        setIsSaving(true);
        try {
            await InventoryAssignmentApi.save({
                userId: user.id,
                userName: user.userName,
                fullName: user.fullName,
                branchId,
            });
            toast.success(t("assignmentSaved"));
            setUserId("");
            setBranchId("");
            await refetch();
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("assignmentSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (id: number) => {
        setRemovingId(id);
        try {
            await InventoryAssignmentApi.remove(id);
            toast.success(t("assignmentDeleted"));
            await refetch();
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("assignmentDeleteError")));
        } finally {
            setRemovingId(null);
        }
    };

    const hasScanRole = (u: UserDto) => u.roles.includes(SCAN_ROLE_NAME);
    const assignedBranchByUser = new Map(assignments.map((a) => [a.userId, a.branchName]));

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/pc/inventory"
                    className="mb-1 inline-flex items-center gap-1.5 py-1 text-sm font-medium text-[#5e3f3a] transition hover:text-[#191c1e]"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> {t("backToReport")}
                </Link>
                <h1 className="text-lg font-semibold text-[#191c1e]">{t("assignmentTitle")}</h1>
            </div>

            <section className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#5e3f3a]">
                    {t("assignmentUserLabel")}
                    <SearchableSelect
                        value={userId}
                        onChange={setUserId}
                        placeholder={t("assignmentUserPlaceholder")}
                        triggerClassName={selectClass}
                        options={users.map((u) => {
                            const label = `${u.fullName ? `${u.fullName} (${u.userName})` : u.userName}${
                                assignedBranchByUser.has(u.id) ? ` — ${assignedBranchByUser.get(u.id)}` : ""
                            }${hasScanRole(u) ? "" : ` [${t("assignmentNoScanRole")}]`}`;
                            return { value: u.id, label, searchText: label.toLowerCase() };
                        })}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#5e3f3a]">
                    {t("assignmentBranchLabel")}
                    <SearchableSelect
                        value={branchId}
                        onChange={setBranchId}
                        placeholder={t("assignmentBranchPlaceholder")}
                        triggerClassName={selectClass}
                        options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                    />
                </label>
                <button
                    onClick={handleSave}
                    disabled={userId === "" || branchId === "" || isSaving}
                    className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-5 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("assignmentSave")}
                </button>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="overflow-x-auto">
                <table className="min-w-[36rem] w-full text-left text-sm">
                    <thead>
                        <tr className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                            <th className="border-b border-[#e0e3e5] px-4 py-3">{t("assignmentColUser")}</th>
                            <th className="border-b border-[#e0e3e5] px-4 py-3">{t("assignmentColBranch")}</th>
                            <th className="w-16 border-b border-[#e0e3e5] px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-[#5e3f3a]">
                                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {t("loading")}
                                </td>
                            </tr>
                        ) : assignments.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-[#8a8f94]">{t("assignmentEmpty")}</td>
                            </tr>
                        ) : (
                            assignments.map((a) => (
                                <tr key={a.id} className="border-b border-[#f1f5f9] last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-[#191c1e]">{a.fullName ?? a.userName}</div>
                                        {a.fullName && <div className="text-xs text-[#8a8f94]">{a.userName}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-[#191c1e]">{a.branchName}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleRemove(a.id)}
                                            disabled={removingId === a.id}
                                            title={t("assignmentRemove")}
                                            aria-label={t("assignmentRemove")}
                                            className="cursor-pointer rounded-lg p-2 text-[#930006] transition hover:bg-[#fff4f2] disabled:opacity-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </section>
        </div>
    );
}
