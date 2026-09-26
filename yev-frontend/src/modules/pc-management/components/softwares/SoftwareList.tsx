"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "react-toastify";

import { SoftwareApi } from "@/modules/pc-management/api/software.api";
import { SoftwareGroupApi } from "@/modules/pc-management/api/software-group.api";
import { getApiErrorMessage } from "@/lib/apiError";
import type { SoftwareDto } from "@/modules/pc-management/types/software.dto";
import type { SoftwareGroupDto } from "@/modules/pc-management/types/software-group.dto";
import SoftwareForm, { type SoftwareFormValues } from "./SoftwareForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;
const PRIORITY_FILTER_ALL = "all";
const PRIORITY_FILTER_NONE = "none";
type PrioritySort = "none" | "asc" | "desc";

// Danh mục phần mềm không phân trang phía BE (grid-list chỉ hỗ trợ keyword),
// nên tải toàn bộ 1 lần rồi lọc/sắp xếp/phân trang phía FE để lọc theo Ưu tiên đúng trên toàn bộ dữ liệu.
const SoftwareList = forwardRef<ListHandle, ListToolbarProps>(function SoftwareList({ onLoadingChange }, ref) {
    const [allSoftwares, setAllSoftwares] = useState<SoftwareDto[]>([]);
    const [groups, setGroups] = useState<SoftwareGroupDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [priorityFilter, setPriorityFilter] = useState<string>(PRIORITY_FILTER_ALL);
    const [prioritySort, setPrioritySort] = useState<PrioritySort>("none");

    const [pageIndex, setPageIndex] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingSoftware, setEditingSoftware] = useState<SoftwareDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingSoftware, setDeletingSoftware] = useState<SoftwareDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchSoftwares } = useFetchEffect(
        () => SoftwareApi.getAllSoftware(),
        [],
        (result) => setAllSoftwares(result),
        "Không thể tải danh sách phần mềm.",
        (message) => toast.error(message),
        "softwares"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchSoftwares,
        openCreate: openCreateForm,
    }));

    useEffect(() => {
        let isCancelled = false;
        (async () => {
            try {
                const result = await SoftwareGroupApi.getAllSoftwareGroup();
                if (!isCancelled) setGroups(result);
            } catch (err) {
                console.error(err);
                if (!isCancelled) toast.error("Không thể tải danh sách nhóm phần mềm.");
            }
        })();
        return () => {
            isCancelled = true;
        };
    }, []);

    const priorityOptions = useMemo(() => {
        const values = new Set<number>();
        let hasNone = false;
        allSoftwares.forEach((software) => {
            if (software.softwarePriority === null) hasNone = true;
            else values.add(software.softwarePriority);
        });
        return { values: Array.from(values).sort((a, b) => a - b), hasNone };
    }, [allSoftwares]);

    const filteredSoftwares = useMemo(() => {
        const keywordLower = appliedKeyword.trim().toLowerCase();
        let list = allSoftwares.filter((software) => {
            const matchesKeyword =
                !keywordLower ||
                software.softwareCode.toLowerCase().includes(keywordLower) ||
                software.softwareName.toLowerCase().includes(keywordLower);
            const matchesPriority =
                priorityFilter === PRIORITY_FILTER_ALL
                    ? true
                    : priorityFilter === PRIORITY_FILTER_NONE
                      ? software.softwarePriority === null
                      : software.softwarePriority === Number(priorityFilter);
            return matchesKeyword && matchesPriority;
        });

        if (prioritySort !== "none") {
            list = [...list].sort((a, b) => {
                const aValue = a.softwarePriority ?? Number.POSITIVE_INFINITY;
                const bValue = b.softwarePriority ?? Number.POSITIVE_INFINITY;
                return prioritySort === "asc" ? aValue - bValue : bValue - aValue;
            });
        }
        return list;
    }, [allSoftwares, appliedKeyword, priorityFilter, prioritySort]);

    const totalCount = filteredSoftwares.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    useEffect(() => {
        if (pageIndex > totalPages) setPageIndex(totalPages);
    }, [pageIndex, totalPages]);

    const pagedSoftwares = useMemo(
        () => filteredSoftwares.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE),
        [filteredSoftwares, pageIndex]
    );

    const hasPreviousPage = pageIndex > 1;
    const hasNextPage = pageIndex < totalPages;

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const handlePriorityFilterChange = (value: string) => {
        setPageIndex(1);
        setPriorityFilter(value);
    };

    const togglePrioritySort = () => {
        setPrioritySort((current) => (current === "none" ? "asc" : current === "asc" ? "desc" : "none"));
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingSoftware(null);
        setFormOpen(true);
    };

    const openEditForm = (software: SoftwareDto) => {
        setFormMode("edit");
        setEditingSoftware(software);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingSoftware(null);
    };

    const handleSubmitForm = async (values: SoftwareFormValues) => {
        setIsSaving(true);
        try {
            const groupId = Number(values.softwareGroupId);
            const payload = {
                softwareCode: values.softwareCode.trim(),
                softwareName: values.softwareName.trim(),
                softwareType: values.softwareType.trim() || null,
                publisher: values.publisher.trim() || null,
                softwareQuantity: values.softwareQuantity === "" ? null : Number(values.softwareQuantity),
                softwarePriority: values.softwarePriority === "" ? null : Number(values.softwarePriority),
                softwareGroupId: groupId,
                softwareGroupName: groups.find((group) => group.id === groupId)?.groupName ?? "",
            };

            if (formMode === "create") {
                await SoftwareApi.createSoftware(payload);
                toast.success("Tạo phần mềm thành công");
            } else if (editingSoftware) {
                await SoftwareApi.updateSoftware(editingSoftware.id, payload);
                toast.success("Cập nhật phần mềm thành công");
            }
            setFormOpen(false);
            setEditingSoftware(null);
            await fetchSoftwares();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo phần mềm thất bại" : "Cập nhật phần mềm thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingSoftware) return;
        setIsDeleting(true);
        try {
            await SoftwareApi.deleteSoftware(deletingSoftware.id);
            toast.success("Xoá phần mềm thành công");
            setDeletingSoftware(null);
            await fetchSoftwares();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá phần mềm thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo mã hoặc tên phần mềm..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                        <select
                            value={priorityFilter}
                            onChange={(event) => handlePriorityFilterChange(event.target.value)}
                            className="h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value={PRIORITY_FILTER_ALL}>Tất cả mức ưu tiên</option>
                            {priorityOptions.values.map((value) => (
                                <option key={value} value={value}>
                                    Ưu tiên {value}
                                </option>
                            ))}
                            {priorityOptions.hasNone && <option value={PRIORITY_FILTER_NONE}>Chưa đặt ưu tiên</option>}
                        </select>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${pagedSoftwares.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã</th>
                                <th className="px-6 py-3">Tên phần mềm</th>
                                <th className="px-6 py-3">Nhóm</th>
                                <th className="px-6 py-3">Loại</th>
                                <th className="px-6 py-3">Nhà phát hành</th>
                                <th className="px-6 py-3 text-right">Số lượng</th>
                                <th className="px-6 py-3 text-right">
                                    <button
                                        type="button"
                                        onClick={togglePrioritySort}
                                        className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a] transition hover:text-[#191c1e]"
                                        title="Sắp xếp theo ưu tiên"
                                    >
                                        Ưu tiên
                                        {prioritySort === "asc" && <ArrowUp size={14} />}
                                        {prioritySort === "desc" && <ArrowDown size={14} />}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && pagedSoftwares.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu phần mềm.
                                    </td>
                                </tr>
                            )}
                            {pagedSoftwares.map((software) => (
                                <tr key={software.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{software.softwareCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{software.softwareName}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{software.softwareGroupName}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{software.softwareType ?? "—"}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{software.publisher ?? "—"}</td>
                                    <td className="px-6 py-4 text-right text-sm text-[#5e3f3a]">{software.softwareQuantity ?? "—"}</td>
                                    <td className="px-6 py-4 text-right text-sm text-[#5e3f3a]">{software.softwarePriority ?? "—"}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(software)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingSoftware(software)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                title="Xoá"
                                            >
                                                Xoá
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        Trang trước
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        Trang {pageIndex} / {totalPages}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            </section>

            <SoftwareForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingSoftware}
                groups={groups}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingSoftware !== null}
                title="Xoá phần mềm"
                message={
                    <>
                        Bạn có chắc muốn xoá phần mềm <strong>{deletingSoftware?.softwareName}</strong> không? Hành động này
                        không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingSoftware(null);
                }}
            />
        </div>
    );
});

export default SoftwareList;
