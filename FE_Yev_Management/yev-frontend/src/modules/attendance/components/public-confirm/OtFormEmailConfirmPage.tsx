"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Clock, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import type { OtFormApprovalHistoryDto, OtFormDto } from "@/modules/attendance/types/ot-form.dto";
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

// Thứ tự ký THẬT (không phải thứ tự số enum) — đồng bộ với OtFormDetail.tsx: Người đề nghị(0) →
// Trưởng Bộ phận(4) → Trưởng phòng(1) → Trưởng xưởng(2) → Tổng Giám Đốc(3).
const TIMELINE_LEVELS = [0, 4, 1, 2, 3];

// Class Tailwind tĩnh theo số cấp thật sự áp dụng (3=TH1, 4=TH2, 5=TH3) — phải viết literal để Tailwind
// JIT quét được, không thể build chuỗi "lg:grid-cols-" + n động.
const APPROVAL_GRID_LG_COLS: Record<number, string> = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
};

type ApprovalStepState = "done" | "current" | "rejected" | "upcoming";

interface ApprovalStep {
    level: number;
    state: ApprovalStepState;
    history: OtFormApprovalHistoryDto | null;
}

// Danh sách cấp THẬT SỰ áp dụng cho 1 đơn — cắt bớt TIMELINE_LEVELS theo otCase.requiredApprovalLevel.
function applicableApprovalLevels(requiredApprovalLevel: number): number[] {
    const finalIndex = TIMELINE_LEVELS.indexOf(requiredApprovalLevel);
    return finalIndex === -1 ? TIMELINE_LEVELS : TIMELINE_LEVELS.slice(0, finalIndex + 1);
}

// Suy trạng thái từng cấp trực tiếp từ approvalHistories — xem OtFormDetail.tsx.
function buildApprovalSteps(form: OtFormDto, levels: number[]): ApprovalStep[] {
    let rejectedIndex = -1;
    const steps = levels.map((level, index): ApprovalStep => {
        const history = form.approvalHistories.find((item) => item.approvalLevel === level) ?? null;
        if (history?.action === 2) {
            rejectedIndex = index;
            return { level, history, state: "rejected" };
        }
        if (history) {
            return { level, history, state: "done" };
        }
        return { level, history: null, state: "upcoming" };
    });

    const firstUpcomingIndex = steps.findIndex((step) => step.state === "upcoming");
    return steps.map((step, index) => {
        if (step.state === "upcoming" && rejectedIndex === -1 && index === firstUpcomingIndex) {
            return { ...step, state: "current" };
        }
        return step;
    });
}

// Route public (không đăng nhập SPA, bảo mật bằng token trong URL) — docs/attendance-api-fe.md §4.6.
// Mở qua link email "Duyệt/Từ chối đơn tăng ca" gửi cho Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc.
export default function OtFormEmailConfirmPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [form, setForm] = useState<OtFormDto | null>(null);
    // Mặc định 3 (TGĐ — hiện đủ 5 cấp) khi chưa tải xong/lỗi tải OtCase (vd OtCase yêu cầu đăng nhập
    // trong khi trang này public) — an toàn hơn là lỡ ẩn mất 1 cấp thật sự cần, xem OtFormDetail.tsx.
    const [requiredApprovalLevel, setRequiredApprovalLevel] = useState(3);

    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionResult, setActionResult] = useState<"approved" | "rejected" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    // Thiếu token ném lỗi dạng JSON {message} để getApiErrorMessage bên trong useFetchEffect parse ra
    // đúng câu thông báo riêng này thay vì rơi về fallback chung.
    const { isLoading, error: loadError } = useFetchEffect(
        async () => {
            if (!token) {
                throw new Error(JSON.stringify({ message: "Thiếu token trong đường link." }));
            }
            const data = await OtFormApi.getOtFormByEmailToken(token);
            let approvalLevel = 3;
            try {
                const otCase = await OtCaseApi.getOtCaseById(data.otCaseId);
                approvalLevel = otCase.requiredApprovalLevel;
            } catch (err) {
                console.error(err);
            }
            return { data, approvalLevel };
        },
        [token],
        (result) => {
            setForm(result.data);
            setRequiredApprovalLevel(result.approvalLevel);
        },
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

    const applicableLevels = applicableApprovalLevels(requiredApprovalLevel);
    const approvalSteps = buildApprovalSteps(form, applicableLevels);

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

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Tiến độ duyệt</h2>
                <div className="flex overflow-x-auto pb-1">
                    {approvalSteps.map((step, index) => (
                        <div key={step.level} className="relative flex min-w-[6.5rem] flex-1 flex-col items-center">
                            {index > 0 && (
                                <div
                                    className={`absolute left-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                        approvalSteps[index - 1].state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                    }`}
                                />
                            )}
                            {index < approvalSteps.length - 1 && (
                                <div
                                    className={`absolute right-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                        step.state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                    }`}
                                />
                            )}
                            <div
                                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                    step.state === "done"
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : step.state === "rejected"
                                        ? "border-[#930006] bg-[#930006] text-white"
                                        : step.state === "current"
                                        ? "border-[#9a5b00] bg-[#fff4e5] text-[#9a5b00]"
                                        : "border-[#e0e3e5] bg-white text-[#9aa0a6]"
                                }`}
                            >
                                {step.state === "done" && <Check size={16} />}
                                {step.state === "rejected" && <X size={16} />}
                                {step.state === "current" && <Clock size={16} />}
                                {step.state === "upcoming" && index + 1}
                            </div>
                            <div
                                className={`mt-2 text-center text-xs font-semibold ${
                                    step.state === "upcoming" ? "text-[#9aa0a6]" : "text-[#191c1e]"
                                }`}
                            >
                                {approvalLevelLabels[step.level]}
                            </div>
                            {step.history ? (
                                <div className="mt-0.5 text-center text-[11px] leading-tight text-[#5e3f3a]">
                                    {step.history.approverFullName ?? step.history.approverUserName}
                                    <br />
                                    {formatDateTime(step.history.actionAt)}
                                </div>
                            ) : step.state === "current" ? (
                                <div className="mt-0.5 text-center text-[11px] text-[#9a5b00]">Đang chờ</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </section>

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
                {form.subReason && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Lý do chi tiết</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{form.subReason}</div>
                    </div>
                )}
            </section>

            {form.processPart && (
                <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Phần xử lý</h2>
                    <div className="flex flex-wrap gap-4 text-sm text-[#191c1e]">
                        <span>Ăn uống: {form.processPart.isEat ? "Có" : "Không"}</span>
                        <span>Xe đưa đón: {form.processPart.isTransportation ? "Có" : "Không"}</span>
                        <span>Phòng copy: {form.processPart.isUseCopyRoom ? "Có" : "Không"}</span>
                    </div>
                    {form.processPart.isEat && (
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#5e3f3a]">
                            <span>Phiếu chính: {form.processPart.mainTicketCount}</span>
                            <span>Phiếu phụ: {form.processPart.secondaryTicketCount}</span>
                            <span>Sữa: {form.processPart.milkCount}</span>
                        </div>
                    )}
                    {form.processPart.anotherSuggestionVn && (
                        <p className="mt-2 text-sm text-[#5e3f3a]">Đề nghị khác: {form.processPart.anotherSuggestionVn}</p>
                    )}
                </section>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <h2 className="border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                    Danh sách nhân viên ({form.numberOfEmployee})
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th rowSpan={2} className="px-6 py-3 align-bottom">Mã NV</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">Họ và tên</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">Thời gian</th>
                                <th colSpan={2} className="border-b border-[#e0e3e5] px-6 py-2 text-center">Lũy kế</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">Phiếu ăn</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">Ghi chú</th>
                            </tr>
                            <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-2 text-center">Tháng</th>
                                <th className="px-6 py-2 text-center">Năm</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.employees.map((employee) => {
                                const isMonthOverLimit = employee.monthToDate > 25;
                                const isYearOverLimit = employee.yearToDate > 300;
                                const isOverLimit = isMonthOverLimit || isYearOverLimit;
                                return (
                                    <tr
                                        key={employee.employeeId}
                                        className={`border-b border-[#f1f5f9] ${isOverLimit ? "bg-[#fdecea]" : ""}`}
                                    >
                                        <td className="px-6 py-3 text-sm font-semibold text-[#191c1e]">{employee.employeeCode}</td>
                                        <td className="px-6 py-3 text-sm text-[#191c1e]">{employee.fullName}</td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                            {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            {employee.monthToDate}h
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            {employee.yearToDate}h
                                        </td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                            {employee.isEligibleForMeal ? <Check size={16} className="text-emerald-600" /> : "-"}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">{employee.noteVn || "-"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Lịch sử ký duyệt</h2>
                <div className={`grid gap-4 md:grid-cols-2 ${APPROVAL_GRID_LG_COLS[applicableLevels.length] ?? "lg:grid-cols-5"}`}>
                    {applicableLevels.map((level) => {
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
                                        {history.comment && <div className="text-xs text-[#191c1e]">&quot;{history.comment}&quot;</div>}
                                        {history.hasSignature && history.signatureImage && (
                                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image không tối ưu được và cần width/height cố định trái với className fluid ở đây
                                            <img
                                                src={`data:image/png;base64,${history.signatureImage}`}
                                                alt={`Chữ ký ${history.approverFullName ?? history.approverUserName}`}
                                                className="h-16 w-full rounded border border-[#e0e3e5] object-contain"
                                            />
                                        )}
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
