"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import {
    approvalActionLabels,
    approvalLevelLabels,
    otFormStatusClasses,
    otFormStatusLabels,
} from "@/modules/attendance/types/enums";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

const TIMELINE_LEVELS = [0, 1, 2, 3];

// Route public (không đăng nhập SPA, bảo mật bằng token trong URL) — docs/attendance-api-fe.md §4.6.
// Mở qua link email "Duyệt/Từ chối đơn tăng ca" gửi cho Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc.
export default function OtFormEmailConfirmPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [form, setForm] = useState<OtFormDto | null>(null);

    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionResult, setActionResult] = useState<"approved" | "rejected" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    // Thiếu token ném lỗi dạng JSON {message} để getApiErrorMessage bên trong useFetchEffect parse ra
    // đúng câu thông báo riêng này thay vì rơi về fallback chung.
    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? OtFormApi.getOtFormByEmailToken(token)
                : Promise.reject(new Error(JSON.stringify({ message: "Thiếu token trong đường link." }))),
        [token],
        (data) => setForm(data),
        "Không thể tải đơn tăng ca — link có thể đã hết hạn hoặc đã được xử lý."
    );

    const handleApprove = async () => {
        setIsSubmitting(true);
        setActionError(null);
        try {
            await OtFormApi.approveOtFormByEmailToken(token, { comment: comment.trim() || null });
            setActionResult("approved");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, "Duyệt đơn thất bại."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            setActionError("Vui lòng nhập lý do từ chối trước khi bấm Từ chối.");
            return;
        }
        setIsSubmitting(true);
        setActionError(null);
        try {
            await OtFormApi.rejectOtFormByEmailToken(token, { comment: comment.trim() });
            setActionResult("rejected");
        } catch (err) {
            console.error(err);
            setActionError(getApiErrorMessage(err, "Từ chối đơn thất bại."));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>;
    }

    if (loadError || !form) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-12">
                <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Đơn tăng ca #{form.id}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {form.departmentNameVn} — {form.groupNameVn}
                    </p>
                </div>
                <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                >
                    {otFormStatusLabels[form.status] ?? "Không xác định"}
                </span>
            </div>

            <section className="grid gap-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Trường hợp OT</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.otCaseCode}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Lý do</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.reasonNameVn}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Ngày</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{formatDate(form.date)}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Thời gian</div>
                    <div className="mt-1 text-sm text-[#191c1e]">
                        {formatTime(form.startTime)} — {formatTime(form.endTime)} ({form.totalHour}h)
                    </div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Người tạo</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.createdByFullName ?? form.createdByUserName}</div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <h2 className="border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                    Danh sách nhân viên ({form.numberOfEmployee})
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã NV</th>
                                <th className="px-6 py-3">Họ và tên</th>
                                <th className="px-6 py-3">Thời gian</th>
                                <th className="px-6 py-3">Lũy kế tháng/năm</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.employees.map((employee) => (
                                <tr key={employee.employeeId} className="border-b border-[#f1f5f9]">
                                    <td className="px-6 py-3 text-sm font-semibold text-[#191c1e]">{employee.employeeCode}</td>
                                    <td className="px-6 py-3 text-sm text-[#191c1e]">{employee.fullName}</td>
                                    <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                        {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                        {employee.monthToDate}h / {employee.yearToDate}h
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Lịch sử ký duyệt</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {TIMELINE_LEVELS.map((level) => {
                        const history = form.approvalHistories.find((item) => item.approvalLevel === level);
                        return (
                            <div key={level} className="rounded-lg border border-[#e0e3e5] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {approvalLevelLabels[level]}
                                </div>
                                {history ? (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-sm font-semibold text-[#191c1e]">
                                            {history.approverFullName ?? history.approverUserName}
                                        </div>
                                        <div className="text-xs text-[#5e3f3a]">{approvalActionLabels[history.action]}</div>
                                        <div className="text-xs text-[#5e3f3a]">{formatDateTime(history.actionAt)}</div>
                                        {history.comment && <div className="text-xs text-[#191c1e]">"{history.comment}"</div>}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs text-[#9aa0a6]">Chưa xử lý</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {actionResult ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {actionResult === "approved" ? "Bạn đã duyệt đơn này thành công." : "Bạn đã từ chối đơn này."}
                </div>
            ) : (
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Ghi chú / Lý do từ chối
                        </span>
                        <textarea
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            disabled={isSubmitting}
                            rows={3}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    {actionError && (
                        <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{actionError}</p>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={handleReject}
                            disabled={isSubmitting}
                            className="cursor-pointer rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Từ chối
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isSubmitting}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting ? "Đang xử lý..." : "Duyệt"}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
