"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { getApiErrorMessage } from "@/lib/apiError";
import { LocalAccountApi } from "@/modules/auth/api/local-account.api";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { dialogInputClassName, dialogLabelClassName, MIN_PASSWORD_LENGTH } from "@/modules/auth/lib/localAccount";
import { useRouter } from "@/navigation";

export default function ChangePasswordForm() {
    const t = useTranslations("ChangePassword");
    const router = useRouter();
    const { user, refreshUser } = useAuth();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Domain passwords live in AD, so this screen has nothing to change for those users.
    const isDomainUser = user !== null && !user.isLocalAccount;
    useEffect(() => {
        if (isDomainUser) router.replace("/");
    }, [isDomainUser, router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            toast.error(t("tooShort"));
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error(t("mismatch"));
            return;
        }

        setIsSaving(true);
        try {
            await LocalAccountApi.changeOwnPassword(currentPassword, newPassword);
            toast.success(t("success"));
            await refreshUser();
            router.replace("/");
        } catch (error) {
            console.error(error);
            toast.error(getApiErrorMessage(error, t("failed")));
        } finally {
            setIsSaving(false);
        }
    };

    if (!user || isDomainUser) return null;

    return (
        <div className="flex min-h-full items-center justify-center bg-[#f8fafc] px-4 py-12">
            <div className="w-full max-w-sm rounded-xl border border-[#e0e3e5] bg-white p-8 shadow-sm">
                <h1 className="text-lg font-semibold text-[#191c1e]">{t("title")}</h1>
                {user.mustChangePassword && <p className="mt-1 text-sm text-[#5e3f3a]">{t("required")}</p>}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <label className="block">
                        <span className={dialogLabelClassName}>{t("current")}</span>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            disabled={isSaving}
                            required
                            autoFocus
                            autoComplete="current-password"
                            className={dialogInputClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={dialogLabelClassName}>{t("new")}</span>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            disabled={isSaving}
                            required
                            maxLength={128}
                            autoComplete="new-password"
                            placeholder={t("placeholder")}
                            className={dialogInputClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={dialogLabelClassName}>{t("confirm")}</span>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            disabled={isSaving}
                            required
                            maxLength={128}
                            autoComplete="new-password"
                            className={dialogInputClassName}
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? t("submitting") : t("submit")}
                    </button>
                </form>
            </div>
        </div>
    );
}
