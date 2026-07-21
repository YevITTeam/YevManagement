"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useLocale } from "next-intl";
import { Check, Clock, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalHistoryDto, OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import {
    approvalActionLabels,
    approvalLevelLabels,
    nextApprovalLevelFromStatus,
    otFormStatusClasses,
    otFormStatusLabels,
} from "@/modules/attendance/types/enums";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter, getPathname } from "@/navigation";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface OtFormDetailProps {
    id: number;
}

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

// Thứ tự ký THẬT (không phải thứ tự số enum): Người đề nghị(0) → Trưởng Bộ phận(4, mới 2026-07-17) →
// Trưởng phòng(1) → Trưởng xưởng(2) → Tổng Giám Đốc(3). approvalLevel trong lịch sử map trực tiếp
// vào timeline này — xem docs §Đợt 6.
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

// Danh sách cấp THẬT SỰ áp dụng cho 1 đơn — cắt bớt TIMELINE_LEVELS theo otCase.requiredApprovalLevel
// (docs §3.4/§1: TH1=1 dừng ở Trưởng phòng, TH2=2 dừng ở Trưởng xưởng, TH3=3 mới tới Tổng Giám Đốc).
// Trưởng nhóm(0)/Trưởng Bộ phận(4) luôn có mặt (bắt buộc cho mọi Group) nên luôn nằm trong kết quả.
function applicableApprovalLevels(requiredApprovalLevel: number): number[] {
    const finalIndex = TIMELINE_LEVELS.indexOf(requiredApprovalLevel);
    return finalIndex === -1 ? TIMELINE_LEVELS : TIMELINE_LEVELS.slice(0, finalIndex + 1);
}

// Suy trạng thái từng cấp TRỰC TIẾP từ approvalHistories (không dựa vào form.status) — chỉ có tối đa 1
// cấp "rejected" (BE dừng luồng ngay khi bị từ chối), cấp đầu tiên chưa có lịch sử (và chưa có ai bị
// từ chối trước đó) là cấp "current" đang chờ xử lý; các cấp sau vẫn coi là "upcoming" dù luồng đã
// dừng vì bị từ chối (đơn giản hoá — không cần phân biệt riêng "cancelled" cho mục đích hiển thị).
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

export default function OtFormDetail({ id }: OtFormDetailProps) {
    const { user } = useAuth();
    const router = useRouter();
    const locale = useLocale();
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [requireSignatureToApprove, setRequireSignatureToApprove] = useState(false);
    // Mặc định 3 (TGĐ — hiện đủ 5 cấp) khi chưa tải xong/lỗi tải OtCase, để KHÔNG lỡ ẩn mất 1 cấp thật
    // sự cần thiết (an toàn hơn là lỡ hiện dư 1 cấp không cần).
    const [requiredApprovalLevel, setRequiredApprovalLevel] = useState(3);
    const [hasMySignature, setHasMySignature] = useState<boolean | null>(null);

    const [actionOpen, setActionOpen] = useState<"submit" | "approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    const { isLoading, error, refetch: fetchForm } = useFetchEffect(
        async () => {
            const data = await OtFormApi.getOtFormById(id);
            let requireSignature = false;
            let approvalLevel = 3;
            try {
                const otCase = await OtCaseApi.getOtCaseById(data.otCaseId);
                requireSignature = otCase.requireSignature;
                approvalLevel = otCase.requiredApprovalLevel;
            } catch (err) {
                console.error(err);
            }
            return { data, requireSignature, approvalLevel };
        },
        [id],
        (result) => {
            setForm(result.data);
            setRequiredApprovalLevel(result.approvalLevel);
            setRequireSignatureToApprove(result.requireSignature);
        },
        "Không thể tải chi tiết đơn tăng ca."
    );

    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    const nextLevel = form ? nextApprovalLevelFromStatus(form.status) : null;
    const showApprovalActions = canApprove && nextLevel !== null;
    // Nút "Ký duyệt" (Trưởng nhóm, đợt 4): chỉ hiện khi đơn còn Draft(5) và user có quyền tạo đơn —
    // đơn giản hoá theo gợi ý docs §1.2 (BE tự chặn 400 nếu user không đúng scope Submitter).
    const canSubmit = form?.status === 5 && hasPermission(user, "Attendance.OTForm.Create");

    // Nút "Sửa" (docs §1.2): isEditable=true + chính người tạo + có quyền tạo đơn.
    const canEdit =
        Boolean(form?.isEditable) &&
        form?.createdByUserName === user?.userName &&
        hasPermission(user, "Attendance.OTForm.Create");
    const canPrint = form?.status === 3;

    const openAction = (type: "submit" | "approve" | "reject") => {
        setComment("");
        setActionOpen(type);
        if (type === "approve" || type === "submit") {
            UserSignatureApi.getMySignature()
                .then((data) => setHasMySignature(Boolean(data)))
                .catch(() => setHasMySignature(false));
        }
    };

    const closeAction = () => {
        if (isSubmittingAction) return;
        setActionOpen(null);
    };

    const handleSubmit = async () => {
        if (hasMySignature === false) {
            toast.error("Bạn chưa đăng ký chữ ký — vào \"Chữ ký của tôi\" để đăng ký trước khi ký duyệt.");
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.submitOtForm(id, { comment: comment.trim() || null });
            toast.success("Ký duyệt \"Người đề nghị\" thành công — đơn đã chuyển sang chờ Trưởng phòng duyệt.");
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Ký duyệt thất bại"));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleApprove = async () => {
        if (requireSignatureToApprove && hasMySignature === false) {
            toast.error("Trường hợp này yêu cầu đã đăng ký chữ ký trước khi duyệt — vào \"Chữ ký của tôi\" để đăng ký.");
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.approveOtForm(id, { comment: comment.trim() || null });
            toast.success("Duyệt đơn thành công");
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Duyệt đơn thất bại"));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            toast.error("Vui lòng nhập lý do từ chối.");
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.rejectOtForm(id, { comment: comment.trim() });
            toast.success("Đã từ chối đơn");
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Từ chối đơn thất bại"));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>;
    }

    if (error || !form) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const applicableLevels = applicableApprovalLevels(requiredApprovalLevel);
    const approvalSteps = buildApprovalSteps(form, applicableLevels);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Đơn tăng ca #{form.id}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {form.departmentNameVn} — {form.groupNameVn}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                    >
                        {otFormStatusLabels[form.status] ?? "Không xác định"}
                    </span>
                    {canEdit && (
                        <button
                            onClick={() => router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } })}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            Sửa đơn
                        </button>
                    )}
                    {canPrint && (
                        <button
                            onClick={() =>
                                window.open(
                                    getPathname({ href: { pathname: "/ot-print", query: { id: String(form.id) } }, locale }),
                                    "_blank",
                                    "noopener,noreferrer"
                                )
                            }
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            In đơn
                        </button>
                    )}
                </div>
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

            {canSubmit && (
                <div className="flex justify-end">
                    <button
                        onClick={() => openAction("submit")}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        Ký duyệt &quot;Người đề nghị&quot;
                    </button>
                </div>
            )}

            {showApprovalActions && (
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => openAction("reject")}
                        className="cursor-pointer rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                    >
                        Từ chối
                    </button>
                    <button
                        onClick={() => openAction("approve")}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        Duyệt
                    </button>
                </div>
            )}

            {actionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeAction} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {actionOpen === "submit" ? "Ký duyệt \"Người đề nghị\"" : actionOpen === "approve" ? "Duyệt đơn" : "Từ chối đơn"}
                            </h3>
                            <button
                                onClick={closeAction}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    Ghi chú {actionOpen === "reject" && <span className="text-[#930006]">*</span>}
                                </span>
                                <textarea
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    disabled={isSubmittingAction}
                                    rows={3}
                                    required={actionOpen === "reject"}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            {actionOpen === "submit" && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        hasMySignature === false
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {hasMySignature === false
                                        ? "Bạn chưa đăng ký chữ ký — vào \"Chữ ký của tôi\" để đăng ký trước khi ký duyệt."
                                        : "Chữ ký \"Người đề nghị\" sẽ tự lấy từ chữ ký đã đăng ký của bạn (\"Chữ ký của tôi\")."}
                                </div>
                            )}

                            {actionOpen === "approve" && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        requireSignatureToApprove && hasMySignature === false
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {requireSignatureToApprove && hasMySignature === false
                                        ? "Trường hợp này yêu cầu chữ ký nhưng bạn chưa đăng ký — vào \"Chữ ký của tôi\" để đăng ký trước khi duyệt."
                                        : "Chữ ký duyệt sẽ tự lấy từ chữ ký đã đăng ký của bạn (\"Chữ ký của tôi\")."}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeAction}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="button"
                                    onClick={actionOpen === "submit" ? handleSubmit : actionOpen === "approve" ? handleApprove : handleReject}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmittingAction
                                        ? "Đang xử lý..."
                                        : actionOpen === "submit"
                                        ? "Xác nhận ký duyệt"
                                        : actionOpen === "approve"
                                        ? "Xác nhận duyệt"
                                        : "Xác nhận từ chối"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
