"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "@/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormListItemDto } from "@/modules/attendance/types/ot-form.dto";
import { otFormStatusClasses, otFormStatusLabels } from "@/modules/attendance/types/enums";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

interface OtFormListPageProps {
    mode: "my-forms" | "pending-submissions" | "pending-approvals";
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

// docs/attendance-api-fe.md §4.2 — my-forms (đơn do chính mình tạo) và pending-approvals (đơn chờ chính
// mình duyệt, BE tự lọc theo cấp/scope) dùng chung shape OtFormListItemDto + phân trang.
export default function OtFormListPage({ mode }: OtFormListPageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const canCreate = hasPermission(user, "Attendance.OTForm.Create");
    const [forms, setForms] = useState<OtFormListItemDto[]>([]);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    // Đổi mode (chuyển menu) → về trang 1, phát hiện bằng so sánh snapshot ngay trong render
    // (React khuyến khích thay effect chỉ để "phản ứng" theo prop/state khác đổi).
    const [prevMode, setPrevMode] = useState(mode);
    if (prevMode !== mode) {
        setPrevMode(mode);
        setPageIndex(1);
    }

    const { isLoading, error, refetch: fetchForms } = useFetchEffect(
        () =>
            mode === "my-forms"
                ? OtFormApi.getMyForms({ pageIndex, pageSize: PAGE_SIZE })
                : mode === "pending-submissions"
                ? OtFormApi.getPendingSubmissions({ pageIndex, pageSize: PAGE_SIZE })
                : OtFormApi.getPendingApprovals({ pageIndex, pageSize: PAGE_SIZE }),
        [mode, pageIndex],
        (result) => {
            setForms(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách đơn tăng ca.",
        (message) => toast.error(message)
    );

    const title =
        mode === "my-forms" ? "Đơn của tôi" : mode === "pending-submissions" ? "Chờ tôi ký duyệt" : "Chờ tôi duyệt";
    const description =
        mode === "my-forms"
            ? "Danh sách đơn tăng ca do bạn tạo."
            : mode === "pending-submissions"
            ? "Danh sách đơn tăng ca đang Nháp, chờ bạn ký duyệt \"Người đề nghị\" trước khi vào luồng duyệt."
            : "Danh sách đơn tăng ca đang chờ bạn duyệt ở cấp hiện tại.";
    const columnCount = mode === "my-forms" ? 8 : 7;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{title}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{description}</p>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${forms.length} / ${totalCount} bản ghi`}
                    </div>
                    <button
                        onClick={() => fetchForms()}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        ↻ Làm mới
                    </button>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Bộ phận / Nhóm</th>
                                <th className="px-6 py-3">Trường hợp</th>
                                <th className="px-6 py-3">Ngày</th>
                                <th className="px-6 py-3">Số giờ</th>
                                <th className="px-6 py-3">Số NV</th>
                                <th className="px-6 py-3">Người tạo</th>
                                <th className="px-6 py-3">Trạng thái</th>
                                {mode === "my-forms" && <th className="px-6 py-3 text-right">Thao tác</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && forms.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có đơn nào.
                                    </td>
                                </tr>
                            )}
                            {forms.map((form) => (
                                <tr
                                    key={form.id}
                                    onClick={() => router.push(`/ot/forms/${form.id}`)}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                                >
                                    <td className="px-6 py-4 align-top">
                                        <div className="text-sm font-semibold text-[#191c1e]">{form.departmentNameVn}</div>
                                        <div className="text-xs text-[#5e3f3a]">{form.groupNameVn}</div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.otCaseCode}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{formatDate(form.date)}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.totalHour}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.numberOfEmployee}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#5e3f3a]">
                                        {form.createdByFullName ?? form.createdByUserName}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <span
                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                                        >
                                            {otFormStatusLabels[form.status] ?? "Không xác định"}
                                        </span>
                                    </td>
                                    {mode === "my-forms" && (
                                        <td className="px-6 py-4 align-top text-right">
                                            {form.isEditable && canCreate && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        router.push(`/ot/forms/${form.id}/edit`);
                                                    }}
                                                    className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                >
                                                    Sửa
                                                </button>
                                            )}
                                        </td>
                                    )}
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
        </div>
    );
}
