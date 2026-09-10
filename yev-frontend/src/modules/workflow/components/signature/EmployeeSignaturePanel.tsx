"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeSignatureApi } from "@/modules/workflow/api/employee-signature.api";
import type { EmployeeSignatureDto } from "@/modules/workflow/types/employee-signature.dto";
import SignatureUpload from "../requests/SignatureUpload";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Mỗi nhân sự tự đăng ký 1 chữ ký, dùng để tự điền lúc duyệt đơn thay vì phải tải ảnh lên mỗi lần
// (workflow-module.md §3.4, §10). ⚠️ PUT /me KHÔNG áp dụng ngay — chỉ gửi email xác nhận, chữ ký cũ
// vẫn có hiệu lực cho tới khi tự bấm xác nhận qua link email (trang public /xac-nhan-chu-ky-quy-trinh).
export default function EmployeeSignaturePanel() {
    const t = useTranslations("Workflow.EmployeeSignature");
    const [signature, setSignature] = useState<EmployeeSignatureDto | null>(null);
    const [draftBase64, setDraftBase64] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const { isLoading } = useFetchEffect(
        () => EmployeeSignatureApi.getMine(),
        [],
        (data) => setSignature(data),
        t("loadError"),
        undefined,
        "employee-signature"
    );

    const handleSave = async () => {
        if (!draftBase64) {
            toast.error(t("chooseImageFirstError"));
            return;
        }
        setIsSaving(true);
        try {
            await EmployeeSignatureApi.upsertMine({ signatureImage: draftBase64 });
            setConfirmationSent(true);
            toast.success(t("confirmationSentToast"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveError")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                {isLoading ? (
                    <div className="space-y-4">
                        <div>
                            <Skeleton className="mb-1.5 h-3 w-32" />
                            <Skeleton className="h-24 w-48" />
                        </div>
                        <Skeleton className="h-4 w-48" />
                    </div>
                ) : (
                    <>
                        <div>
                            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                {t("currentSignatureLabel")}
                            </div>
                            {signature ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image không tối ưu được và cần width/height cố định trái với className fluid ở đây */}
                                    <img
                                        src={`data:image/png;base64,${signature.signatureImage}`}
                                        alt={t("currentSignatureAlt")}
                                        className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                                    />
                                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-700">
                                        <Check className="h-3.5 w-3.5 shrink-0" />
                                        {t("lastUpdated", { date: new Date(signature.updatedAt).toLocaleString("vi-VN") })}
                                    </p>
                                </>
                            ) : (
                                <p className="flex items-center gap-1.5 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-sm text-[#9a5b00]">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    {t("notRegistered")}
                                </p>
                            )}
                        </div>

                        {confirmationSent ? (
                            <div className="flex items-center gap-1.5 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-3 text-sm text-[#9a5b00]">
                                <Clock className="h-4 w-4 shrink-0" />
                                {t("confirmationSentMessage")}
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        {t("uploadNewLabel")}
                                    </div>
                                    <p className="mb-2 text-xs text-[#5e3f3a]">{t("uploadHint")}</p>
                                    <SignatureUpload key="draft" onChange={setDraftBase64} disabled={isSaving} />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSaving ? t("sending") : t("sendConfirmButton")}
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
