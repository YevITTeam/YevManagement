"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { FileText, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import FormDialog from "@/components/common/FormDialog";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { Tabs } from "@/components/ui/Tabs";
import { getApiErrorMessage } from "@/lib/apiError";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import { TimeRange } from "@/modules/attendance/components/ot-form/TimeRange";
import { openPaperScan } from "@/modules/attendance/lib/paperScan";
import type { OtFormPaperScanListItemDto } from "@/modules/attendance/types/ot-form.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Link } from "@/navigation";

type StatusKey = "0" | "1" | "2";

const inputClassName =
    "w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const labelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]";
const smallButtonClassName = "cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition";

export default function PaperScanReviewPage() {
    const t = useTranslations("Attendance.PaperScan");
    const [status, setStatus] = useState<StatusKey>("0");
    const [items, setItems] = useState<OtFormPaperScanListItemDto[]>([]);
    const [review, setReview] = useState<{ formId: number; approve: boolean } | null>(null);
    const [comment, setComment] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(() => OtFormApi.getPaperScans(Number(status)), [status], setItems, t("loadError"));

    const isPending = status === "0";
    const columnCount = 7;

    const openReview = (formId: number, approve: boolean) => {
        setComment("");
        setPassword("");
        setReview({ formId, approve });
    };

    const submitReview = async () => {
        if (!review) return;
        if (!comment.trim()) {
            toast.error(t("reasonRequired"));
            return;
        }
        if (!password) {
            toast.error(t("passwordRequired"));
            return;
        }
        setIsSubmitting(true);
        try {
            const body = { comment: comment.trim(), secondaryPassword: password };
            await (review.approve ? OtFormApi.approvePaperScan(review.formId, body) : OtFormApi.rejectPaperScan(review.formId, body));
            toast.success(review.approve ? t("approveSuccess") : t("rejectSuccess"));
            setReview(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("reviewError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-lg font-semibold text-[#191c1e]">{t("title")}</h1>
                <button
                    type="button"
                    onClick={() => void refetch()}
                    className={`${smallButtonClassName} inline-flex items-center gap-2 border border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]`}
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("refresh")}
                </button>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="overflow-x-auto border-b border-[#e0e3e5] px-4 py-2.5">
                    <Tabs<StatusKey>
                        tabs={[
                            { key: "0", label: t("statusPending") },
                            { key: "1", label: t("statusApproved") },
                            { key: "2", label: t("statusRejected") },
                        ]}
                        activeKey={status}
                        onChange={setStatus}
                    />
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-2 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                            <tr>
                                <th className="px-4 py-2.5">{t("colForm")}</th>
                                <th className="px-4 py-2.5">{t("colTime")}</th>
                                <th className="px-4 py-2.5">{t("colUnit")}</th>
                                <th className="px-4 py-2.5">{t("colCase")}</th>
                                <th className="px-4 py-2.5">{t("colSender")}</th>
                                <th className="px-4 py-2.5">{t("colFile")}</th>
                                <th className="px-4 py-2.5">{isPending ? <span className="sr-only">{t("approve")}</span> : t("colResult")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <TableSkeletonRows rows={5} columns={columnCount} />
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount}>
                                        <EmptyState icon={FileText} title={t("empty")} />
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.otFormId} className="border-b border-[#f1f5f9] bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                        <td className="px-4 py-2.5 font-semibold text-[#191c1e]">
                                            <Link href={{ pathname: "/ot/forms", query: { id: String(item.otFormId) } }} prefetch={false} className="hover:text-[#e3000f]">
                                                #{item.otFormId}
                                            </Link>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-[#191c1e]">
                                            <div>{new Date(item.date).toLocaleDateString("vi-VN")}</div>
                                            <div className="text-xs text-[#5e3f3a]">
                                                <TimeRange start={item.startTime.slice(0, 5)} end={item.endTime.slice(0, 5)} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 leading-5 text-[#191c1e]">
                                            <div>{item.departmentNameVn}</div>
                                            {item.groupNameVn && <div className="text-xs text-[#5e3f3a]">{item.groupNameVn}</div>}
                                        </td>
                                        <td className="px-4 py-2.5 text-[#5e3f3a]">{item.otCaseCode}</td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-[#191c1e]">
                                            <div>{item.uploadedByFullName ?? item.uploadedByUserName}</div>
                                            <div className="text-xs text-[#5e3f3a]">{new Date(item.uploadedAt).toLocaleString("vi-VN")}</div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <button
                                                type="button"
                                                title={item.fileName}
                                                onClick={() => openPaperScan(item.otFormId, t("openError"))}
                                                className={`${smallButtonClassName} inline-flex items-center gap-1.5 border border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]`}
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                {t("viewFile")}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {isPending ? (
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => openReview(item.otFormId, true)} className={`${smallButtonClassName} bg-[#e3000f] text-white hover:bg-[#b40009]`}>
                                                        {t("approve")}
                                                    </button>
                                                    <button type="button" onClick={() => openReview(item.otFormId, false)} className={`${smallButtonClassName} border border-[#e0e3e5] bg-white text-[#930006] hover:bg-[#f2f4f6]`}>
                                                        {t("reject")}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="min-w-48 leading-5">
                                                    <div className="text-[#191c1e]">{item.reviewComment}</div>
                                                    <div className="text-xs text-[#5e3f3a]">
                                                        {item.reviewedByFullName}
                                                        {item.reviewedAt && ` · ${new Date(item.reviewedAt).toLocaleString("vi-VN")}`}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <FormDialog
                isOpen={review !== null}
                title={review ? (review.approve ? t("approveTitle", { id: review.formId }) : t("rejectTitle", { id: review.formId })) : ""}
                onClose={() => setReview(null)}
                onSubmit={() => void submitReview()}
                loading={isSubmitting}
                submitLabel={review?.approve ? t("approve") : t("reject")}
                cancelLabel={t("cancel")}
                maxWidthClassName="max-w-md"
            >
                <label className="block">
                    <span className={labelClassName}>{t("fieldReason")}<RequiredMark /></span>
                    <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} disabled={isSubmitting} className={inputClassName} />
                </label>
                <label className="block">
                    <span className={labelClassName}>{t("fieldPassword")}<RequiredMark /></span>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} autoComplete="off" className={inputClassName} />
                </label>
            </FormDialog>
        </div>
    );
}
