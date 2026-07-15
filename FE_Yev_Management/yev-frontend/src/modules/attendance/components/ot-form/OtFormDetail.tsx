"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import {
    approvalActionLabels,
    approvalLevelLabels,
    nextApprovalLevelFromStatus,
    otFormStatusClasses,
    otFormStatusLabels,
} from "@/modules/attendance/types/enums";
import SignatureCanvas from "../signature/SignatureCanvas";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

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

// 4 ô ký theo mẫu giấy gốc YEV-22-024 (src/assets/file-ot-form/FormOT.pdf): Người đề nghị → Trưởng
// phòng → Trưởng xưởng → Tổng Giám Đốc. approvalLevel trong lịch sử map trực tiếp vào timeline này.
const TIMELINE_LEVELS = [0, 1, 2, 3];

export default function OtFormDetail({ id }: OtFormDetailProps) {
    const { user } = useAuth();
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requireSignatureToApprove, setRequireSignatureToApprove] = useState(false);

    const [actionOpen, setActionOpen] = useState<"approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");
    const [approveSignature, setApproveSignature] = useState<string | null>(null);
    const [mySignaturePreview, setMySignaturePreview] = useState<string | null>(null);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    const fetchForm = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await OtFormApi.getOtFormById(id);
            setForm(data);
            try {
                const otCase = await OtCaseApi.getOtCaseById(data.otCaseId);
                setRequireSignatureToApprove(otCase.requireSignature);
            } catch (err) {
                console.error(err);
            }
        } catch (err) {
            console.error(err);
            setError(getApiErrorMessage(err, "Không thể tải chi tiết đơn tăng ca."));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    const nextLevel = form ? nextApprovalLevelFromStatus(form.status) : null;
    const showApprovalActions = canApprove && nextLevel !== null;

    const openAction = (type: "approve" | "reject") => {
        setComment("");
        setApproveSignature(null);
        setActionOpen(type);
        if (type === "approve") {
            UserSignatureApi.getMySignature()
                .then((data) => setMySignaturePreview(data?.signatureImage ?? null))
                .catch((err) => console.error(err));
        }
    };

    const closeAction = () => {
        if (isSubmittingAction) return;
        setActionOpen(null);
    };

    const handleApprove = async () => {
        if (requireSignatureToApprove && !approveSignature) {
            toast.error("Trường hợp này yêu cầu ký khi duyệt.");
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.approveOtForm(id, { comment: comment.trim() || null, signatureImage: approveSignature });
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

    return (
        <div className="space-y-6">
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
                    <div className="mt-1 text-sm text-[#191c1e]">{form.createdByUserName}</div>
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
                                <th className="px-6 py-3">Mã NV</th>
                                <th className="px-6 py-3">Họ và tên</th>
                                <th className="px-6 py-3">Thời gian</th>
                                <th className="px-6 py-3">Ghi chú</th>
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
                                    <td className="px-6 py-3 text-sm text-[#5e3f3a]">{employee.noteVn || "-"}</td>
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
                                        <div className="text-sm font-semibold text-[#191c1e]">{history.approverUserName}</div>
                                        <div className="text-xs text-[#5e3f3a]">{approvalActionLabels[history.action]}</div>
                                        <div className="text-xs text-[#5e3f3a]">{formatDateTime(history.actionAt)}</div>
                                        {history.comment && <div className="text-xs text-[#191c1e]">"{history.comment}"</div>}
                                        {history.hasSignature && history.signatureImage && (
                                            <img
                                                src={`data:image/png;base64,${history.signatureImage}`}
                                                alt={`Chữ ký ${history.approverUserName}`}
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
                                {actionOpen === "approve" ? "Duyệt đơn" : "Từ chối đơn"}
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

                            {actionOpen === "approve" && (
                                <div>
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        Chữ ký {requireSignatureToApprove && <span className="text-[#930006]">*</span>}
                                    </span>
                                    <SignatureCanvas
                                        key={mySignaturePreview ?? "empty"}
                                        initialImage={mySignaturePreview}
                                        onChange={setApproveSignature}
                                        disabled={isSubmittingAction}
                                    />
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
                                    onClick={actionOpen === "approve" ? handleApprove : handleReject}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmittingAction ? "Đang xử lý..." : actionOpen === "approve" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
