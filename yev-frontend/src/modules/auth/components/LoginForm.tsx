"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Monitor } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiError";
import BrandLogo from "@/components/common/BrandLogo";

const REMEMBERED_USERNAME_KEY = "yev_remembered_username";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function LoginForm() {
    const t = useTranslations("Login");
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loginWithPassword, loginWithWindows } = useAuth();

    // Lazy init — chỉ đọc localStorage 1 lần lúc mount, không dùng useEffect (không có gì để "đồng bộ lại"
    // khi state khác đổi, xem frontend-conventions.md §3 "you-might-not-need-an-effect").
    const [userName, setUserName] = useState(() =>
        typeof window === "undefined" ? "" : window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ""
    );
    const [rememberUsername, setRememberUsername] = useState(() => userName.length > 0);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isWindowsLoggingIn, setIsWindowsLoggingIn] = useState(false);

    const redirectAfterLogin = () => {
        const target = searchParams.get("redirect");
        router.replace(target && target.startsWith("/") ? target : "/");
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!userName.trim() || !password) return;

        setIsSubmitting(true);
        try {
            await loginWithPassword({ userName: userName.trim(), password });

            if (typeof window !== "undefined") {
                if (rememberUsername) {
                    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, userName.trim());
                } else {
                    window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
                }
            }

            redirectAfterLogin();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("failed")));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWindowsLogin = async () => {
        setIsWindowsLoggingIn(true);
        try {
            await loginWithWindows();
            redirectAfterLogin();
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("windowsFailed")));
        } finally {
            setIsWindowsLoggingIn(false);
        }
    };

    const isBusy = isSubmitting || isWindowsLoggingIn;

    return (
        <div className="flex min-h-full items-center justify-center bg-[#f8fafc] px-4 py-12">
            <div className="w-full max-w-sm rounded-xl border border-[#e0e3e5] bg-white p-8 shadow-sm">
                <div className="mb-7 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2.5">
                        <BrandLogo className="h-6 w-12" />
                        <span className="text-base font-semibold text-[#191c1e]">YEV Management</span>
                    </div>
                    <h1 className="text-lg font-semibold text-[#191c1e]">{t("title")}</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("userName")}</span>
                        <input
                            value={userName}
                            onChange={(event) => setUserName(event.target.value)}
                            placeholder={t("userNamePlaceholder")}
                            disabled={isBusy}
                            autoFocus
                            required
                            autoComplete="username"
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("password")}</span>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                placeholder="Nhập mật khẩu"
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={isBusy}
                                required
                                autoComplete="current-password"
                                className={`${fieldClassName} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                tabIndex={-1}
                                className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#5e3f3a]">
                        <input
                            type="checkbox"
                            checked={rememberUsername}
                            onChange={(event) => setRememberUsername(event.target.checked)}
                            disabled={isBusy}
                            className="h-4 w-4 cursor-pointer rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#ffe0e3]"
                        />
                        {t("remember")}
                    </label>

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <LogIn className="h-4 w-4" />
                        {isSubmitting ? t("submitting") : t("submit")}
                    </button>
                </form>

                <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-[#8a8f94]">
                    <div className="h-px flex-1 bg-[#e0e3e5]" />
                    {t("or")}
                    <div className="h-px flex-1 bg-[#e0e3e5]" />
                </div>

                <button
                    type="button"
                    onClick={handleWindowsLogin}
                    disabled={isBusy}
                    title={t("ssoNote")}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2.5 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Monitor className="h-4 w-4 text-[#5e3f3a]" />
                    {isWindowsLoggingIn ? t("submitting") : t("windows")}
                </button>
            </div>
        </div>
    );
}
