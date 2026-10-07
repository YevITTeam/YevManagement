"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { UserSignatureDto } from "@/modules/attendance/types/user-signature.dto";
import SignatureUpload from "./SignatureUpload";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// docs/attendance-module.md §API/§6b — mỗi user tự đăng ký 1 chữ ký, BE tự lấy chữ ký này khi tạo/duyệt
// đơn. ⚠️ 2026-07-16: PUT /me KHÔNG còn áp dụng ngay — chỉ gửi email xác nhận, chữ ký cũ vẫn có hiệu
// lực cho tới khi user tự bấm xác nhận qua link email (trang public /xac-nhan-chu-ky).
export default function UserSignaturePanel() {
    const t = useTranslations("Attendance.UserSignature");
    const tCommon = useTranslations("Common");
    const [signature, setSignature] = useState<UserSignatureDto | null>(null);
    const [draftBase64, setDraftBase64] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const { isLoading } = useFetchEffect(
        () => UserSignatureApi.getMySignature(),
        [],
        (data) => setSignature(data),
        t("loadError"),
        (message) => toast.error(message),
        "user-signature"
    );

    const handleSave = async () => {
        if (!draftBase64) {
            toast.error(t("chooseImageFirstError"));
            return;
        }
        setIsSaving(true);
        try {
            await UserSignatureApi.upsertMySignature({ signatureImage: draftBase64 });
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
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("title")}</h1>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
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
