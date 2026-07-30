"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import type { SecondaryPasswordStatusDto } from "@/modules/attendance/types/secondary-password.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// docs/docs-be/attendance-module.md — Mật khẩu cấp 2: mỗi user tự đăng ký 1 mật khẩu riêng, được yêu
// cầu nhập lại ở mọi hành động ký/duyệt OtForm (submit/approve/reject). PUT /me KHÔNG áp dụng ngay —
// chỉ gửi email xác nhận, mật khẩu cũ vẫn có hiệu lực cho tới khi user tự bấm xác nhận qua link email
// (trang public /xac-nhan-mat-khau-cap-2) — mirror UserSignaturePanel.tsx.
export default function SecondaryPasswordPanel() {
    const t = useTranslations("Attendance.SecondaryPassword");
    const tCommon = useTranslations("Common");
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
        (message) => toast.error(message)
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
            </div>

            <section className="max-w-xl space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : (
                    <>
                        <div>
                            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                {t("currentStatusLabel")}
                            </div>
                            {status?.isRegistered ? (
                                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    {status.updatedAt
                                        ? t("registeredWithDate", { date: new Date(status.updatedAt).toLocaleString("vi-VN") })
                                        : t("registered")}
                                </p>
                            ) : (
                                <p className="rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-sm text-[#9a5b00]">
                                    {t("notRegistered")}
                                </p>
                            )}
                        </div>

                        {confirmationSent ? (
                            <div className="rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-3 text-sm text-[#9a5b00]">
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
                                <p className="text-xs text-[#5e3f3a]">{t("passwordHint")}</p>
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
