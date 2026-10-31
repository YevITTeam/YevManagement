"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import type { SecondaryPasswordConfirmationPreviewDto } from "@/modules/attendance/types/secondary-password.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { createBilingualTranslator } from "@/modules/attendance/lib/bilingual";

// Public route secured by the URL token; always bilingual (VN/JP) regardless of the /vi or /ja segment.
// BE never returns the password, so only account + expiry are shown.
export default function SecondaryPasswordConfirmPage() {
    const t = createBilingualTranslator("Attendance.SecondaryPasswordConfirm");
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [preview, setPreview] = useState<SecondaryPasswordConfirmationPreviewDto | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    // Throw a JSON {message} so getApiErrorMessage surfaces this specific text instead of the generic fallback.
    const { isLoading, error: loadError } = useFetchEffect(
        () =>
            token
                ? SecondaryPasswordApi.getConfirmation(token)
                : Promise.reject(new Error(JSON.stringify({ message: t("missingTokenError") }))),
        [token],
        (data) => setPreview(data),
        t("loadError")
    );

    const handleConfirm = async () => {
        setIsConfirming(true);
        setConfirmError(null);
        try {
            await SecondaryPasswordApi.confirmMine(token);
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
