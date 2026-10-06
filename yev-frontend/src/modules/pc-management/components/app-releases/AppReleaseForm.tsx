"use client";

import { useState } from "react";
import { CircleCheck, File, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import type { AppReleaseDto } from "@/modules/pc-management/types/app-release.dto";
import { AppReleaseApi } from "@/modules/pc-management/api/app-release.api";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { getApiErrorMessage } from "@/lib/apiError";
import { RequiredMark } from "@/components/ui/RequiredMark";

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
    /** Version code of the newest release, shown as a hint next to the version code field. */
    latestVersionCode?: number | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: AppReleaseFormValues) => void | Promise<void>;
}

// Number fields stay "" until typed so the placeholder shows instead of a leading 0.
interface DraftValues {
    versionCode: number | "";
    versionName: string;
    minVersionCode: number | "";
    apkUrl: string;
    changelog: string;
}

interface PickedFile {
    name: string;
    size: number;
}

const MAX_APK_BYTES = 300 * 1024 * 1024;

const emptyDraft: DraftValues = { versionCode: "", versionName: "", minVersionCode: "", apkUrl: "", changelog: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]";
const fieldHintClassName = "mt-1.5 text-xs text-[#6b7075]";
const fieldClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition placeholder:text-[#6b7075] focus:border-[#e3000f] focus:ring-2 focus:ring-[#e3000f]/15 disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Long names are cut in the middle so the extension stays visible.
function splitFileName(name: string): [string, string] {
    if (name.length <= 18) return [name, ""];
    return [name.slice(0, -12), name.slice(-12)];
}

function fileNameFromUrl(url: string): string {
    const last = url.split("?")[0].split("/").filter(Boolean).pop() ?? url;
    try {
        return decodeURIComponent(last);
    } catch {
        return last;
    }
}

export default function AppReleaseForm({ isOpen, mode, initial, latestVersionCode, loading = false, onClose, onSubmit }: AppReleaseFormProps) {
    const t = useTranslations("Asset.AppRelease");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const [values, setValues] = useState<DraftValues>(emptyDraft);
    const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useDialogReset(isOpen, initial, (current) => {
        setPickedFile(null);
        setIsDragging(false);
        setValues(
            current
                ? {
                    versionCode: current.versionCode,
                    versionName: current.versionName,
                    minVersionCode: current.minVersionCode,
                    apkUrl: current.apkUrl,
                    changelog: current.changelog ?? "",
                }
                : emptyDraft
        );
    });

    if (!isOpen) return null;

    const handleChange = <K extends keyof DraftValues>(field: K, value: DraftValues[K]) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleNumberChange = (field: "versionCode" | "minVersionCode", raw: string) => {
        handleChange(field, raw === "" ? "" : Number(raw));
    };

    const uploadFile = async (file: File) => {
        if (!file.name.toLowerCase().endsWith(".apk")) {
            toast.error(t("apkInvalidType"));
            return;
        }
        if (file.size > MAX_APK_BYTES) {
            toast.error(t("apkTooLarge"));
            return;
        }

        setIsUploading(true);
        try {
            const url = await AppReleaseApi.uploadApk(file);
            handleChange("apkUrl", url);
            setPickedFile({ name: file.name, size: file.size });
            toast.success(t("uploadApkSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("uploadApkError")));
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void uploadFile(file);
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (loading || isUploading) return;
        const file = event.dataTransfer.files?.[0];
        if (file) void uploadFile(file);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (values.versionCode === "" || values.minVersionCode === "" || !values.versionName.trim() || !values.apkUrl.trim()) return;
        onSubmit({
            versionCode: values.versionCode,
            versionName: values.versionName.trim(),
            minVersionCode: values.minVersionCode,
            apkUrl: values.apkUrl.trim(),
            changelog: values.changelog.trim() || null,
        });
    };

    const keepsExistingApk = mode === "edit" && initial?.apkUrl === values.apkUrl && values.apkUrl !== "";
    const showFileRow = pickedFile !== null || keepsExistingApk;
    const displayName = pickedFile?.name ?? fileNameFromUrl(values.apkUrl);
    const [nameHead, nameTail] = splitFileName(displayName);
    const sizeLabel = pickedFile
        ? `${(pickedFile.size / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`
        : "";
    const isBusy = loading || isUploading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-release-form-title"
                className="z-60 mx-4 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="app-release-form-title" className="min-w-0 truncate text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle", { name: initial?.versionName ?? "" })}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="-mr-1.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <span className={fieldLabelClassName}>
                            {t("fieldApkFile")}
                            <RequiredMark />
                        </span>
                        {showFileRow ? (
                            <div className="flex items-center gap-3 rounded-xl border border-[#e0e3e5] bg-[#f8fafc] p-3">
                                <File className="size-5 shrink-0 text-[#6b7075]" />
                                <div className="min-w-0 flex-1">
                                    <p className="flex min-w-0 text-sm font-medium text-[#191c1e]" title={displayName}>
                                        <span className="truncate">{nameHead}</span>
                                        {nameTail && <span className="shrink-0">{nameTail}</span>}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#5e3f3a]">
                                        {pickedFile ? (
                                            <>
                                                <CircleCheck className="size-3.5 text-[#1e7a34]" />
                                                {t("apkUploaded", { size: sizeLabel })}
                                            </>
                                        ) : (
                                            t("apkCurrent")
                                        )}
                                    </p>
                                </div>
                                <label
                                    className={`text-xs font-medium text-[#191c1e] underline-offset-2 hover:underline ${
                                        isBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                    }`}
                                >
                                    <input type="file" accept=".apk" onChange={handleFileSelected} disabled={isBusy} className="sr-only" />
                                    {isUploading ? t("uploadingApk") : t("changeFile")}
                                </label>
                            </div>
                        ) : (
                            <label
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    if (!isBusy) setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                className={`flex flex-col items-center rounded-xl border border-dashed px-6 py-6 text-center transition-colors ${
                                    isBusy ? "cursor-not-allowed" : "cursor-pointer hover:bg-[#f2f4f6]"
                                } ${isDragging ? "border-[#191c1e]/40 bg-[#f2f4f6]" : "border-[#d4d7da] bg-[#f8fafc]/60"}`}
                            >
                                <input type="file" accept=".apk" onChange={handleFileSelected} disabled={isBusy} className="sr-only" />
                                <p className="text-sm font-medium text-[#191c1e] [@media(hover:none)]:hidden">{t("dropzoneTitle")}</p>
                                <p className="mt-1 text-sm text-[#5e3f3a]">{t("dropzoneHint")}</p>
                                <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e]">
                                    <Upload className="size-3.5" />
                                    {isUploading ? t("uploadingApk") : t("chooseFile")}
                                </span>
                            </label>
                        )}
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>
                            {t("fieldApkUrl")}
                            <RequiredMark />
                        </span>
                        <input
                            value={values.apkUrl}
                            onChange={(event) => handleChange("apkUrl", event.target.value)}
                            placeholder={t("fieldApkUrlPlaceholder")}
                            disabled={isBusy}
                            required
                            className={`${fieldClassName} font-mono text-xs`}
                        />
                        <p className={fieldHintClassName}>{t("fieldApkUrlHint")}</p>
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>
                                {t("fieldVersionCode")}
                                <RequiredMark />
                            </span>
                            <input
                                type="number"
                                value={values.versionCode}
                                onChange={(event) => handleNumberChange("versionCode", event.target.value)}
                                placeholder={t("fieldVersionCodePlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                            {latestVersionCode != null && (
                                <p className={fieldHintClassName}>{t("fieldVersionCodeHint", { code: latestVersionCode })}</p>
                            )}
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>
                                {t("fieldVersionName")}
                                <RequiredMark />
                            </span>
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
                        <span className={fieldLabelClassName}>
                            {t("fieldMinVersionCode")}
                            <RequiredMark />
                        </span>
                        <input
                            type="number"
                            value={values.minVersionCode}
                            onChange={(event) => handleNumberChange("minVersionCode", event.target.value)}
                            placeholder={t("fieldMinVersionCodePlaceholder")}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                        <p className={fieldHintClassName}>{t("fieldMinVersionCodeHint")}</p>
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldChangelog")}</span>
                        <textarea
                            value={values.changelog}
                            onChange={(event) => handleChange("changelog", event.target.value)}
                            placeholder={t("fieldChangelogPlaceholder")}
                            disabled={loading}
                            rows={4}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition placeholder:text-[#6b7075] focus:border-[#e3000f] focus:ring-2 focus:ring-[#e3000f]/15 disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#e6e9ec] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={isBusy}
                            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
