"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { approvalLevelLabels } from "@/modules/attendance/types/enums";
import OtCaseForm, { type OtCaseFormValues } from "./OtCaseForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

const OtCaseList = forwardRef<ListHandle, ListToolbarProps>(function OtCaseList({ onLoadingChange }, ref) {
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingOtCase, setEditingOtCase] = useState<OtCaseDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingOtCase, setDeletingOtCase] = useState<OtCaseDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchOtCases } = useFetchEffect(
        () => OtCaseApi.getOtCasePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setOtCases(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách trường hợp OT.",
        (message) => toast.error(message)
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingOtCase(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchOtCases,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (otCase: OtCaseDto) => {
        setFormMode("edit");
        setEditingOtCase(otCase);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingOtCase(null);
    };

    const handleSubmitForm = async (values: OtCaseFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await OtCaseApi.createOtCase(values);
                toast.success("Tạo trường hợp OT thành công");
            } else if (editingOtCase) {
                await OtCaseApi.updateOtCase(editingOtCase.id, values);
                toast.success("Cập nhật trường hợp OT thành công");
            }
            setFormOpen(false);
            setEditingOtCase(null);
            await fetchOtCases();
        } catch (err) {
            console.error(err);
            toast.error(
                getApiErrorMessage(err, formMode === "create" ? "Tạo trường hợp OT thất bại" : "Cập nhật trường hợp OT thất bại")
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingOtCase) return;
        setIsDeleting(true);
        try {
            await OtCaseApi.deleteOtCase(deletingOtCase.id);
            toast.success("Xoá trường hợp OT thành công");
            setDeletingOtCase(null);
            await fetchOtCases();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá trường hợp OT thất bại"));
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
                            placeholder="Tìm theo mã trường hợp..."
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
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${otCases.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã</th>
                                <th className="px-6 py-3">Mô tả</th>
                                <th className="px-6 py-3">Cấp duyệt cuối</th>
                                <th className="px-6 py-3">Bắt buộc ký</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && otCases.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu trường hợp OT.
                                    </td>
                                </tr>
                            )}
                            {otCases.map((otCase) => (
                                <tr key={otCase.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{otCase.code}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{otCase.description || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">
                                        {approvalLevelLabels[otCase.requiredApprovalLevel] ?? otCase.requiredApprovalLevel}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{otCase.requireSignature ? "Có" : "Không"}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(otCase)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingOtCase(otCase)}
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

            <OtCaseForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingOtCase}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingOtCase !== null}
                title="Xoá trường hợp OT"
                message={
                    <>
                        Bạn có chắc muốn xoá trường hợp <strong>{deletingOtCase?.code}</strong> không? Hành động này không
                        thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingOtCase(null);
                }}
            />
        </div>
    );
});

export default OtCaseList;
