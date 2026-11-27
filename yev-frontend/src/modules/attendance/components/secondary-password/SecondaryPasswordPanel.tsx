"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clock, Mail } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";

import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import type { SecondaryPasswordStatusDto } from "@/modules/attendance/types/secondary-password.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Skeleton } from "@/components/ui/Skeleton";

// PUT /me only sends a confirmation email; the old password stays valid until the user confirms via the link.
export default function SecondaryPasswordPanel() {
    const t = useTranslations("Attendance.SecondaryPassword");
    const locale = useLocale();
    const [status, setStatus] = useState<SecondaryPasswordStatusDto | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const { isLoading } = useFetchEffect(
        () => SecondaryPasswordApi.getMyStatus(),
        [],
        (data) => setStatus(data),
        t("loadError"),
        (message) => toast.error(message),
        "secondary-password-status"
    );

    const handleSave = async () => {
        if (password.length < 6) {
            toast.error(t("passwordTooShortError"));
            return;
        }
        if (password !== confirmPassword) {
            toast.error(t("passwordMismatchError"));
            return;
        }
        setIsSaving(true);
        try {
            await SecondaryPasswordApi.upsertMine({ password });
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
                    <Skeleton className="h-24 w-full" />
                ) : (
                    <>
                        {status?.isRegistered ? (
                            <p
                                title={status.updatedAt ? new Date(status.updatedAt).toLocaleString(locale) : undefined}
                                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600"
                            >
                                <Check className="h-4 w-4 shrink-0" />
                                {status.updatedAt ? t("registeredWithDate", { date: new Date(status.updatedAt).toLocaleDateString(locale) }) : t("registered")}
                            </p>
                        ) : (
                            <p className="flex items-center gap-1.5 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-sm text-[#9a5b00]">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {t("notRegistered")}
                            </p>
                        )}

                        {confirmationSent ? (
                            <div title={t("confirmationSentHint")} className="flex items-center gap-1.5 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-sm text-[#9a5b00]">
                                <Clock className="h-4 w-4 shrink-0" />
                                {t("confirmationSentMessage")}
                            </div>
                        ) : (
                            <>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        {t("newPasswordLabel")}
                                    </span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        disabled={isSaving}
                                        autoComplete="new-password"
                                        placeholder={t("passwordHint")}
                                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        {t("confirmPasswordLabel")}
                                    </span>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        disabled={isSaving}
                                        autoComplete="new-password"
                                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                    />
                                </label>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Mail className="h-4 w-4" />
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
