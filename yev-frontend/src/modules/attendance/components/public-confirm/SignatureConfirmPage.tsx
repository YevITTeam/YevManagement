"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import type { SignatureConfirmationPreviewDto } from "@/modules/attendance/types/user-signature.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { createBilingualTranslator } from "@/modules/attendance/lib/bilingual";

// Route public (không đăng nhập SPA, bảo mật bằng token trong URL) — docs/attendance-api-fe.md §6b.
// Mở qua link email "Xác nhận cập nhật chữ ký". Bilingual (VN / JP) cố định bất kể route đang là
// /vi hay /ja (2026-07-29, user request) — xem createBilingualTranslator trong lib/bilingual.ts,
// đồng bộ với OtFormEmailConfirmPage.tsx.
export default function SignatureConfirmPage() {
    const t = createBilingualTranslator("Attendance.SignatureConfirm");
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [preview, setPreview] = useState<SignatureConfirmationPreviewDto | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    // Thiếu token ném lỗi dạng JSON {message} để getApiErrorMessage bên trong useFetchEffect parse ra
    // đúng câu thông báo riêng này thay vì rơi về fallback chung.
    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? UserSignatureApi.getSignatureConfirmation(token)
                : Promise.reject(new Error(JSON.stringify({ message: t("missingTokenError") }))),
        [token],
        (data) => setPreview(data),
        t("loadError")
    );

    const handleConfirm = async () => {
        setIsConfirming(true);
        setConfirmError(null);
        try {
            await UserSignatureApi.confirmSignature(token);
            setConfirmed(true);
        } catch (err) {
            console.error(err);
            setConfirmError(getApiErrorMessage(err, t("confirmError")));
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="mx-auto max-w-lg px-4 py-12">
            <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("title")}</h1>

                {isLoading && <p className="mt-4 text-sm text-[#5e3f3a]">{t("loading")}</p>}

                {!isLoading && loadError && (
                    <p className="mt-4 rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                        {loadError}
                    </p>
                )}

                {!isLoading && !loadError && preview && !confirmed && (
                    <div className="mt-4 space-y-4">
                        <p className="text-sm text-[#5e3f3a]">
                            {t("accountLabel", { userName: preview.userName })}
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image không tối ưu được và cần width/height cố định trái với className fluid ở đây */}
                        <img
                            src={`data:image/png;base64,${preview.signatureImage}`}
                            alt={t("newSignatureAlt")}
                            className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                        />
                        <p className="text-sm text-[#191c1e]">
                            {t("confirmQuestion", { expiresAt: new Date(preview.expiresAt).toLocaleString("vi-VN") })}
                        </p>
                        {confirmError && (
                            <p className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                                {confirmError}
                            </p>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="cursor-pointer w-full rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming ? t("confirming") : t("confirmButton")}
                        </button>
                    </div>
                )}

                {confirmed && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {t("successMessage")}
                    </div>
                )}
            </div>
        </div>
    );
}
