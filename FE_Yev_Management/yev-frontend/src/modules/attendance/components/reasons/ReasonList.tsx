"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { ReasonApi } from "@/modules/attendance/api/reason.api";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import ReasonForm, { type ReasonFormValues } from "./ReasonForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const PAGE_SIZE = 10;

const ReasonList = forwardRef<ListHandle, ListToolbarProps>(function ReasonList({ onLoadingChange }, ref) {
    const [reasons, setReasons] = useState<ReasonDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingReason, setEditingReason] = useState<ReasonDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingReason, setDeletingReason] = useState<ReasonDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchReasons = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await ReasonApi.getReasonPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            });
            setReasons(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Không thể tải danh sách lý do.");
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReasons();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingReason(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchReasons,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (reason: ReasonDto) => {
        setFormMode("edit");
        setEditingReason(reason);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingReason(null);
    };

    const handleSubmitForm = async (values: ReasonFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await ReasonApi.createReason(values);
                toast.success("Tạo lý do thành công");
            } else if (editingReason) {
                await ReasonApi.updateReason(editingReason.id, values);
                toast.success("Cập nhật lý do thành công");
            }
            setFormOpen(false);
            setEditingReason(null);
            await fetchReasons();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo lý do thất bại" : "Cập nhật lý do thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingReason) return;
        setIsDeleting(true);
        try {
            await ReasonApi.deleteReason(deletingReason.id);
            toast.success("Xoá lý do thành công");
            setDeletingReason(null);
            await fetchReasons();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá lý do thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo lý do..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${reasons.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Lý do (VN)</th>
                                <th className="px-6 py-3">Lý do (JP)</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && reasons.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu lý do.
                                    </td>
                                </tr>
                            )}
                            {reasons.map((reason) => (
                                <tr key={reason.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{reason.reasonNameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{reason.reasonNameJp || "-"}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(reason)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingReason(reason)}
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

            <ReasonForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingReason}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingReason !== null}
                title="Xoá lý do"
                message={
                    <>
                        Bạn có chắc muốn xoá lý do <strong>{deletingReason?.reasonNameVn}</strong> không? Hành động này không
                        thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingReason(null);
                }}
            />
        </div>
    );
});

export default ReasonList;
