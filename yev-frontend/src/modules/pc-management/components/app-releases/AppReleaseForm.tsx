"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import type { AppReleaseDto } from "@/modules/pc-management/types/app-release.dto";
import { AppReleaseApi } from "@/modules/pc-management/api/app-release.api";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { getApiErrorMessage } from "@/lib/apiError";

export interface AppReleaseFormValues {
    versionCode: number;
    versionName: string;
    minVersionCode: number;
    apkUrl: string;
    changelog: string | null;
}

interface AppReleaseFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: AppReleaseDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: AppReleaseFormValues) => void | Promise<void>;
}

const emptyValues: AppReleaseFormValues = { versionCode: 0, versionName: "", minVersionCode: 0, apkUrl: "", changelog: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function AppReleaseForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: AppReleaseFormProps) {
    const t = useTranslations("Asset.AppRelease");
    const tCommon = useTranslations("Common");
    const [values, setValues] = useState<AppReleaseFormValues>(emptyValues);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                    versionCode: current.versionCode,
                    versionName: current.versionName,
                    minVersionCode: current.minVersionCode,
                    apkUrl: current.apkUrl,
                    changelog: current.changelog,
                }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = <K extends keyof AppReleaseFormValues>(field: K, value: AppReleaseFormValues[K]) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await AppReleaseApi.uploadApk(file);
            handleChange("apkUrl", url);
            toast.success(t("uploadApkSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("uploadApkError")));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.versionName.trim() || !values.apkUrl.trim()) return;
        onSubmit({ ...values, changelog: values.changelog?.trim() || null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-release-form-title"
                className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="app-release-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldVersionCode")}</span>
                            <input
                                type="number"
                                value={values.versionCode}
                                onChange={(event) => handleChange("versionCode", Number(event.target.value))}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldVersionName")}</span>
                            <input
                                value={values.versionName}
                                onChange={(event) => handleChange("versionName", event.target.value)}
                                placeholder={t("fieldVersionNamePlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldMinVersionCode")}</span>
                        <input
                            type="number"
                            value={values.minVersionCode}
                            onChange={(event) => handleChange("minVersionCode", Number(event.target.value))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                        <span className="mt-1 block text-xs text-[#8a8f94]">{t("fieldMinVersionCodeHint")}</span>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldApkUrl")}</span>
                        <input
                            value={values.apkUrl}
                            onChange={(event) => handleChange("apkUrl", event.target.value)}
                            placeholder={t("fieldApkUrlPlaceholder")}
                            disabled={loading || isUploading}
                            required
                            className={fieldClassName}
                        />
                        <div className="mt-1.5 flex items-center gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".apk"
                                onChange={handleFileSelected}
                                disabled={loading || isUploading}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading || isUploading}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <UploadCloud className="h-3.5 w-3.5" />
                                {isUploading ? t("uploadingApk") : t("uploadApkButton")}
                            </button>
                            <span className="text-xs text-[#8a8f94]">{t("fieldApkUrlHint")}</span>
                        </div>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldChangelog")}</span>
                        <textarea
                            value={values.changelog ?? ""}
                            onChange={(event) => handleChange("changelog", event.target.value)}
                            placeholder={t("fieldChangelogPlaceholder")}
                            disabled={loading}
                            rows={4}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isUploading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
