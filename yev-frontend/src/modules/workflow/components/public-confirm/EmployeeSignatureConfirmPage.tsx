"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmployeeSignatureApi } from "@/modules/workflow/api/employee-signature.api";
import type { SignatureConfirmationPreviewDto } from "@/modules/workflow/types/employee-signature.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { createBilingualTranslator } from "@/modules/workflow/lib/bilingual";

// Public token-secured page opened from the email link; always bilingual regardless of locale.
// Mirrors attendance's SignatureConfirmPage (no cross-module import).
export default function EmployeeSignatureConfirmPage() {
    const t = createBilingualTranslator("Workflow.SignatureConfirm");
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [preview, setPreview] = useState<SignatureConfirmationPreviewDto | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    // Thrown as JSON {message} so getApiErrorMessage shows this exact text instead of the generic fallback.
    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? EmployeeSignatureApi.getSignatureConfirmation(token)
                : Promise.reject(new Error(JSON.stringify({ message: t("missingTokenError") }))),
        [token],
        (data) => setPreview(data),
        t("loadError")
    );

    const handleConfirm = async () => {
        setIsConfirming(true);
        setConfirmError(null);
        try {
            await EmployeeSignatureApi.confirmSignature(token);
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
                            {t("accountLabel", { employeeFullName: preview.employeeFullName })}
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI; next/image needs fixed width/height */}
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
