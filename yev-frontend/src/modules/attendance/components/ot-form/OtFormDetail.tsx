"use client";

import { useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { Car, Check, Clock, MessageCircle, Printer, UserX, Utensils, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalHistoryDto, OtFormDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import {
    approvalActionLabels,
    approvalLevelLabels,
    nextApprovalLevelFromStatus,
    otFormStatusClasses,
    otFormStatusLabels,
} from "@/modules/attendance/types/enums";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { calculateHours, formatHours } from "@/modules/attendance/lib/time";
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

// Ô hiển thị 1 mục trong "Yêu cầu hỗ trợ khác" (ăn uống/xe đưa đón/phòng copy) — badge màu xanh lá khi
// Có, xám khi Không (mặc định khi form.processPart null), thay vì chuỗi text phẳng như trước.
function ProcessPartTile({
    icon,
    label,
    active,
    activeLabel,
    inactiveLabel,
}: {
    icon: ReactNode;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-[#191c1e]">
                <span className="text-[#5e3f3a]">{icon}</span>
                {label}
            </span>
            <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-[#e0e3e5] bg-white text-[#8a8f94]"
                }`}
            >
                {active ? <Check size={12} /> : <X size={12} />}
                {active ? activeLabel : inactiveLabel}
            </span>
        </div>
    );
}

export default function OtFormDetail({ id }: OtFormDetailProps) {
    const t = useTranslations("Attendance.OtFormDetail");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const router = useRouter();
    const locale = useLocale();
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [requireSignatureToApprove, setRequireSignatureToApprove] = useState(false);
    // Mặc định 3 (TGĐ — hiện đủ 5 cấp) khi chưa tải xong/lỗi tải OtCase, để KHÔNG lỡ ẩn mất 1 cấp thật
    // sự cần thiết (an toàn hơn là lỡ hiện dư 1 cấp không cần).
    const [requiredApprovalLevel, setRequiredApprovalLevel] = useState(3);
    const [hasMySignature, setHasMySignature] = useState<boolean | null>(null);
    const [hasSecondaryPassword, setHasSecondaryPassword] = useState<boolean | null>(null);

    const [actionOpen, setActionOpen] = useState<"submit" | "approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Loại 1 nhân viên khỏi đơn — modal RIÊNG với submit/approve/reject (docs §4.5a), người dùng đã
    // chốt luồng 2 bước: loại xong xem lại đơn rồi mới bấm Duyệt, không gộp vào modal Duyệt.
    // Không yêu cầu mật khẩu cấp 2 (khác Duyệt/Từ chối) — chốt lại 2026-07-31, áp dụng cho cả kênh
    // trong app lẫn email.
    const [removeTarget, setRemoveTarget] = useState<OtFormEmployeeDto | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [isRemovingEmployee, setIsRemovingEmployee] = useState(false);

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
        t("loadError")
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

    // Nút "Loại khỏi đơn" trên từng dòng nhân viên (docs §4.5a, mới 2026-07-30): hiện đúng lúc caller
    // đang ở đúng cấp có thể ký/duyệt đơn này (canSubmit cho Draft, showApprovalActions cho các cấp
    // sau) VÀ có permission riêng Attendance.OTForm.RemoveEmployee — permission này KHÔNG cấp cho Role
    // "Nhân viên" (chỉ tạo đơn, không ký/duyệt) dù họ cũng có canSubmit=false nên thực chất không cần
    // lọc thêm ở đây, permission check là đủ.
    const canRemoveEmployee = hasPermission(user, "Attendance.OTForm.RemoveEmployee") && (canSubmit || showApprovalActions);

    const openAction = (type: "submit" | "approve" | "reject") => {
        setComment("");
        setSecondaryPassword("");
        setActionOpen(type);
        if (type === "approve" || type === "submit") {
            UserSignatureApi.getMySignature()
                .then((data) => setHasMySignature(Boolean(data)))
                .catch(() => setHasMySignature(false));
        }
        // Mật khẩu cấp 2 áp dụng cho CẢ 3 hành động (submit/approve/reject) — xem
        // docs/docs-be/attendance-module.md — Mật khẩu cấp 2.
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    };

    const closeAction = () => {
        if (isSubmittingAction) return;
        setActionOpen(null);
    };

    const handleSubmit = async () => {
        if (hasMySignature === false) {
            toast.error(t("submitSignatureMissingError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.submitOtForm(id, { comment: comment.trim() || null, secondaryPassword });
            toast.success(t("submitSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("submitError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleApprove = async () => {
        if (requireSignatureToApprove && hasMySignature === false) {
            toast.error(t("approveSignatureMissingError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.approveOtForm(id, { comment: comment.trim() || null, secondaryPassword });
            toast.success(t("approveSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("approveError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            toast.error(t("rejectCommentRequiredError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.rejectOtForm(id, { comment: comment.trim(), secondaryPassword });
            toast.success(t("rejectSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("rejectError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const openRemove = (employee: OtFormEmployeeDto) => {
        setRemoveReason("");
        setRemoveTarget(employee);
    };

    const closeRemove = () => {
        if (isRemovingEmployee) return;
        setRemoveTarget(null);
    };

    const handleRemoveEmployee = async () => {
        if (!removeTarget) return;
        if (!removeReason.trim()) {
            toast.error(t("removeReasonRequiredError"));
            return;
        }
        setIsRemovingEmployee(true);
        try {
            const updated = await OtFormApi.removeOtFormEmployee(id, {
                employeeId: removeTarget.employeeId,
                reason: removeReason.trim(),
            });
            toast.success(t("removeSuccess", { name: removeTarget.fullName }));
            setForm(updated);
            setRemoveTarget(null);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("removeError")));
        } finally {
            setIsRemovingEmployee(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (error || !form) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const applicableLevels = applicableApprovalLevels(requiredApprovalLevel);
    const approvalSteps = buildApprovalSteps(form, applicableLevels);
    // Người đã bị loại khỏi đơn KHÔNG tính vào tổng giờ OT — họ không còn nằm trong đơn được duyệt
    // (docs §4.5a). Vẫn hiện dòng của họ trong bảng bên dưới để giữ dấu vết ai loại/khi nào/vì sao.
    const activeEmployees = form.employees.filter((employee) => !employee.isRemoved);
    const totalWorkedHours = activeEmployees.reduce(
        (sum, employee) => sum + calculateHours(employee.startTime, employee.endTime),
        0
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("titleWithId", { id: form.id })}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {bilingualText(form.departmentNameVn, form.departmentNameJp)} — {bilingualText(form.groupNameVn, form.groupNameJp)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                    >
                        {otFormStatusLabels[form.status] ?? t("unknownStatus")}
                    </span>
                    {canEdit && (
                        <button
                            onClick={() => router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } })}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {t("editButton")}
                        </button>
                    )}
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
                        {t("printButton")}
                    </button>
                </div>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("approvalProgressTitle")}</h2>
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
                                <div className="mt-0.5 text-center text-[11px] text-[#9a5b00]">{t("waitingShort")}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("otCaseLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.otCaseCode}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("reasonLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{bilingualText(form.reasonNameVn, form.reasonNameJp)}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("dateLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{formatDate(form.date)}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("timeLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">
                        {formatTime(form.startTime)} — {formatTime(form.endTime)} ({form.totalHour}h)
                    </div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("createdByLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.createdByFullName ?? form.createdByUserName}</div>
                </div>
                {form.subReason && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("subReasonLabel")}</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{form.subReason}</div>
                    </div>
                )}
            </section>

            {/* Luôn hiện khối này, kể cả khi form.processPart null (đơn không yêu cầu hỗ trợ gì thêm) —
                mặc định "Không" cho 3 checkbox, cùng cách OtFormPrintView.tsx đã xử lý từ trước
                (processPart?.isEat ?? false). Trước đây ẩn hẳn cả khối khi null, khiến người dùng
                tưởng thiếu thông tin dù đây là giá trị mặc định hợp lệ, không phải dữ liệu bị mất. */}
            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("processPartTitle")}</h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <ProcessPartTile
                        icon={<Utensils size={16} />}
                        label={t("eatFieldLabel")}
                        active={Boolean(form.processPart?.isEat)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                    <ProcessPartTile
                        icon={<Car size={16} />}
                        label={t("transportationFieldLabel")}
                        active={Boolean(form.processPart?.isTransportation)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                    <ProcessPartTile
                        icon={<Printer size={16} />}
                        label={t("copyRoomFieldLabel")}
                        active={Boolean(form.processPart?.isUseCopyRoom)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                </div>
                {form.processPart?.isEat && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("mainTicketLabel", { count: form.processPart.mainTicketCount })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("secondaryTicketLabel", { count: form.processPart.secondaryTicketCount })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("milkLabel", { count: form.processPart.milkCount })}
                        </span>
                    </div>
                )}
                {form.processPart?.anotherSuggestionVn && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#5e3f3a]">
                        <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#5e3f3a]" />
                        <span>
                            <span className="font-semibold text-[#191c1e]">{t("anotherSuggestionFieldLabel")}: </span>
                            {bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}
                        </span>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("employeeListTitle", { count: form.numberOfEmployee })}
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs font-semibold text-[#191c1e]">
                        {t("totalWorkedHoursLabel", { hours: formatHours(totalWorkedHours) })}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colEmployeeCode")}</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colFullName")}</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colTime")}</th>
                                <th rowSpan={2} className="px-6 py-3 text-center align-bottom">{t("colHours")}</th>
                                <th colSpan={2} className="border-b border-[#e0e3e5] px-6 py-2 text-center">{t("colAccumulation")}</th>
                                <th rowSpan={2} className="px-6 py-3 text-center align-bottom">{t("colMeal")}</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colNote")}</th>
                                {canRemoveEmployee && <th rowSpan={2} className="px-6 py-3 align-bottom" />}
                            </tr>
                            <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-2 text-center">{t("colMonth")}</th>
                                <th className="px-6 py-2 text-center">{t("colYear")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.employees.map((employee) => {
                                const isMonthOverLimit = employee.monthToDate > 25;
                                const isYearOverLimit = employee.yearToDate > 300;
                                const isOverLimit = isMonthOverLimit || isYearOverLimit;
                                const hours = calculateHours(employee.startTime, employee.endTime);
                                // Đã bị loại khỏi đơn (docs §4.5a) — vẫn hiện dòng để giữ dấu vết, nhưng
                                // làm mờ + gạch ngang, thay toàn bộ cột số liệu bằng lý do/người loại.
                                if (employee.isRemoved) {
                                    return (
                                        <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#f8fafc] opacity-60">
                                            <td className="px-6 py-3 text-sm">
                                                <span className="inline-flex items-center rounded-md bg-[#eceef0] px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e] line-through">
                                                    {employee.employeeCode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-medium text-[#191c1e] line-through">{employee.fullName}</td>
                                            <td colSpan={5} className="px-6 py-3 text-sm text-[#930006]">
                                                {t("removedInlineNote", {
                                                    name: employee.removedByFullName ?? employee.removedByUserName ?? "",
                                                    level: employee.removedAtLevel !== null ? approvalLevelLabels[employee.removedAtLevel] : "",
                                                    reason: employee.removeReason ?? "",
                                                })}
                                                {employee.removedAt && (
                                                    <span className="ml-2 text-[#9aa0a6]">({formatDateTime(employee.removedAt)})</span>
                                                )}
                                            </td>
                                            {canRemoveEmployee && <td className="px-6 py-3" />}
                                        </tr>
                                    );
                                }
                                return (
                                    <tr
                                        key={employee.employeeId}
                                        className={`border-b border-[#f1f5f9] transition-colors ${
                                            isOverLimit ? "bg-[#fff4f2] hover:bg-[#ffe9e6]" : "hover:bg-[#f8fafc]"
                                        }`}
                                    >
                                        <td className="px-6 py-3 text-sm">
                                            <span className="inline-flex items-center rounded-md bg-[#eceef0] px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e]">
                                                {employee.employeeCode}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm font-medium text-[#191c1e]">{employee.fullName}</td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                            {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                                        </td>
                                        <td className="px-6 py-3 text-center text-sm">
                                            <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                                {formatHours(hours)}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            {employee.monthToDate}h
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            {employee.yearToDate}h
                                        </td>
                                        <td className="px-6 py-3 text-center text-sm text-[#5e3f3a]">
                                            {employee.isEligibleForMeal ? (
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
                                                    <Check size={14} className="text-emerald-600" />
                                                </span>
                                            ) : (
                                                <span className="text-[#9aa0a6]">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>
                                        {canRemoveEmployee && (
                                            <td className="px-6 py-3 text-right">
                                                {activeEmployees.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openRemove(employee)}
                                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e9bcb6] bg-white px-2.5 py-1 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                                                    >
                                                        <UserX className="h-3.5 w-3.5" />
                                                        {t("removeEmployeeButton")}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("approvalHistoryTitle")}</h2>
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
                                                alt={t("signatureAlt", { name: history.approverFullName ?? history.approverUserName })}
                                                className="h-16 w-full rounded border border-[#e0e3e5] object-contain"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs text-[#9aa0a6]">{t("notProcessedYet")}</div>
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
                        {t("submitButton")}
                    </button>
                </div>
            )}

            {showApprovalActions && (
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => openAction("reject")}
                        className="cursor-pointer rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                    >
                        {t("rejectButton")}
                    </button>
                    <button
                        onClick={() => openAction("approve")}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        {t("approveButton")}
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
                                {actionOpen === "submit" ? t("modalTitleSubmit") : actionOpen === "approve" ? t("modalTitleApprove") : t("modalTitleReject")}
                            </h3>
                            <button
                                onClick={closeAction}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("commentLabel")} {actionOpen === "reject" && <span className="text-[#930006]">*</span>}
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

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={secondaryPassword}
                                    onChange={(event) => setSecondaryPassword(event.target.value)}
                                    disabled={isSubmittingAction}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div
                                className={`rounded-lg border px-3 py-2 text-xs ${
                                    hasSecondaryPassword === false
                                        ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                        : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                }`}
                            >
                                {hasSecondaryPassword === false ? t("secondaryPasswordMissingHint") : t("secondaryPasswordOkHint")}
                            </div>

                            {actionOpen === "submit" && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        hasMySignature === false
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {hasMySignature === false ? t("submitSignatureMissingHint") : t("submitSignatureOkHint")}
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
                                        ? t("approveSignatureMissingHint")
                                        : t("approveSignatureOkHint")}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeAction}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={actionOpen === "submit" ? handleSubmit : actionOpen === "approve" ? handleApprove : handleReject}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmittingAction
                                        ? tCommon("processing")
                                        : actionOpen === "submit"
                                        ? t("confirmSubmit")
                                        : actionOpen === "approve"
                                        ? t("confirmApprove")
                                        : t("confirmReject")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {removeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeRemove} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("removeModalTitle", { name: removeTarget.fullName })}</h3>
                            <button
                                onClick={closeRemove}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-[#5e3f3a]">{t("removeModalDesc")}</p>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("removeReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={removeReason}
                                    onChange={(event) => setRemoveReason(event.target.value)}
                                    disabled={isRemovingEmployee}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeRemove}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemoveEmployee}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isRemovingEmployee ? tCommon("processing") : t("confirmRemove")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
