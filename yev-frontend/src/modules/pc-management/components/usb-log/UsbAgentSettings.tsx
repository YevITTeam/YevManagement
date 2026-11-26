"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { Badge } from "@/components/ui/Badge";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbAgentReleaseDto, UsbAgentSettingDto } from "@/modules/pc-management/types/usb-log.dto";
import { formatBytes, formatDateTime } from "./usb-log-format";

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:bg-[#f8fafc]";
const linkButtonClassName = "cursor-pointer text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50";

// Fleet-wide agent options: copy-in logging, sync interval, list clean-up, uninstall password and auto-update.
export default function UsbAgentSettings({ canEdit }: { canEdit: boolean }) {
    const t = useTranslations("usbLog");
    const [saved, setSaved] = useState<UsbAgentSettingDto | null>(null);
    const [trackCopyIn, setTrackCopyIn] = useState(false);
    const [targetVersion, setTargetVersion] = useState("");
    const [updateMachines, setUpdateMachines] = useState("");
    const [syncSeconds, setSyncSeconds] = useState("60");
    // "" = keep uninstalled agents in the list.
    const [purgeDays, setPurgeDays] = useState("");
    const [releases, setReleases] = useState<UsbAgentReleaseDto[]>([]);
    const [busy, setBusy] = useState(false);

    const [passwordOpen, setPasswordOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [clearingPassword, setClearingPassword] = useState(false);

    const [releasesOpen, setReleasesOpen] = useState(false);
    const [exeFile, setExeFile] = useState<File | null>(null);
    const [releaseNote, setReleaseNote] = useState("");
    const [deleting, setDeleting] = useState<UsbAgentReleaseDto | null>(null);

    const apply = (result: UsbAgentSettingDto) => {
        setSaved(result);
        setTrackCopyIn(result.trackCopyIn);
        setTargetVersion(result.targetVersion ?? "");
        setUpdateMachines(result.updateMachines ?? "");
        setSyncSeconds(String(result.syncSeconds));
        setPurgeDays(result.purgeUninstalledDays?.toString() ?? "");
    };

    useFetchEffect(
        () => Promise.all([UsbLogApi.getAgentSetting(), UsbLogApi.getReleases()]),
        [],
        ([setting, list]) => {
            apply(setting);
            setReleases(list);
        },
        t("settings.loadError"),
        (message) => toast.error(message)
    );

    const dirty =
        saved !== null &&
        (trackCopyIn !== saved.trackCopyIn ||
            targetVersion !== (saved.targetVersion ?? "") ||
            updateMachines.trim() !== (saved.updateMachines ?? "") ||
            syncSeconds !== String(saved.syncSeconds) ||
            purgeDays !== (saved.purgeUninstalledDays?.toString() ?? ""));

    const run = async (action: () => Promise<void>, failMessage: string) => {
        setBusy(true);
        try {
            await action();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, failMessage));
        } finally {
            setBusy(false);
        }
    };

    const handleSave = () =>
        run(async () => {
            apply(
                await UsbLogApi.updateAgentSetting({
                    trackCopyIn,
                    targetVersion: targetVersion || null,
                    updateMachines: updateMachines.trim() || null,
                    syncSeconds: Number(syncSeconds),
                    purgeUninstalledDays: purgeDays ? Number(purgeDays) : null,
                })
            );
            toast.success(t("settings.saveSuccess"));
        }, t("settings.saveFailed"));

    const handlePassword = (value: string) =>
        run(async () => {
            await UsbLogApi.setUninstallPassword(value);
            if (saved) setSaved({ ...saved, hasUninstallPassword: value !== "" });
            toast.success(value ? t("settings.passwordSet") : t("settings.passwordCleared"));
            setPasswordOpen(false);
            setClearingPassword(false);
            setPassword("");
        }, t("settings.passwordFailed"));

    const handleUpload = () =>
        run(async () => {
            if (!exeFile) {
                toast.error(t("settings.selectExe"));
                return;
            }
            const release = await UsbLogApi.uploadRelease(exeFile, releaseNote.trim());
            setReleases([release, ...releases]);
            setExeFile(null);
            setReleaseNote("");
            toast.success(t("settings.uploadSuccess", { version: release.version }));
        }, t("settings.uploadFailed"));

    const handleDelete = () =>
        run(async () => {
            if (!deleting) return;
            await UsbLogApi.deleteRelease(deleting.id);
            setReleases(releases.filter((r) => r.id !== deleting.id));
            setDeleting(null);
            toast.success(t("settings.releaseDeleted"));
        }, t("settings.releaseDeleteFailed"));

    const versionOptions = [{ value: "", label: t("settings.noAutoUpdate") }, ...releases.map((r) => ({ value: r.version, label: r.version }))];

    return (
        <section className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
            <label
                className="flex h-9 cursor-pointer items-center gap-2 text-sm text-[#191c1e]"
                title={t("settings.trackCopyInTitle")}
            >
                <input
                    type="checkbox"
                    checked={trackCopyIn}
                    disabled={!canEdit || saved === null}
                    onChange={(event) => setTrackCopyIn(event.target.checked)}
                    className="h-4 w-4 accent-[#e3000f]"
                />
                {t("settings.trackCopyIn")}
            </label>

            <label className="block w-28" title={t("settings.syncTitle")}>
                <span className={fieldLabelClassName}>{t("settings.syncSeconds")}</span>
                <input
                    type="number"
                    min={15}
                    max={600}
                    value={syncSeconds}
                    onChange={(event) => setSyncSeconds(event.target.value)}
                    disabled={!canEdit || saved === null}
                    className={`${fieldClassName} w-full`}
                />
            </label>
            <label className="block w-36" title={t("settings.purgeAfterTitle")}>
                <span className={fieldLabelClassName}>{t("settings.purgeAfter")}</span>
                <input
                    type="number"
                    min={1}
                    max={3650}
                    value={purgeDays}
                    onChange={(event) => setPurgeDays(event.target.value)}
                    disabled={!canEdit || saved === null}
                    placeholder={t("settings.purgeNever")}
                    aria-label={t("settings.daysAria")}
                    className={`${fieldClassName} w-full`}
                />
            </label>

            <div className="flex h-9 items-center gap-2 text-sm text-[#191c1e]" title={t("settings.passwordTitle")}>
                {t("settings.password")}
                {saved && <Badge variant={saved.hasUninstallPassword ? "success" : "neutral"}>{saved.hasUninstallPassword ? t("settings.passwordIsSet") : t("settings.passwordNotSet")}</Badge>}
                {canEdit && saved && (
                    <>
                        <button onClick={() => setPasswordOpen(true)} disabled={busy} className={linkButtonClassName}>
                            {saved.hasUninstallPassword ? t("settings.change") : t("settings.set")}
                        </button>
                        {saved.hasUninstallPassword && (
                            <button onClick={() => setClearingPassword(true)} disabled={busy} className={linkButtonClassName}>
                                {t("settings.clear")}
                            </button>
                        )}
                    </>
                )}
            </div>

            <label className="block w-40">
                <span className={fieldLabelClassName}>{t("settings.autoUpdate")}</span>
                <StyledSelect
                    value={targetVersion}
                    onChange={setTargetVersion}
                    options={versionOptions}
                    disabled={!canEdit || saved === null}
                    triggerClassName={`${fieldClassName} w-full pr-8`}
                />
            </label>
            {targetVersion && (
                <label className="block w-full sm:w-80">
                    <span className={fieldLabelClassName}>{t("settings.pilotMachines")}</span>
                    <input
                        value={updateMachines}
                        onChange={(event) => setUpdateMachines(event.target.value)}
                        disabled={!canEdit}
                        placeholder={t("settings.pilotPlaceholder")}
                        title={t("settings.pilotTitle")}
                        className={`${fieldClassName} w-full`}
                    />
                </label>
            )}
            {canEdit && (
                <button onClick={() => setReleasesOpen(true)} className={`${linkButtonClassName} h-9`}>
                    {t("settings.releasesButton", { count: releases.length })}
                </button>
            )}
            {canEdit && dirty && (
                <button
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("common.save")}
                </button>
            )}

            <FormDialog
                isOpen={passwordOpen}
                title={t("settings.passwordDialogTitle")}
                onClose={() => setPasswordOpen(false)}
                onSubmit={() => (password.length >= 6 ? handlePassword(password) : toast.error(t("settings.passwordTooShort")))}
                loading={busy}
                submitLabel={t("common.save")}
                cancelLabel={t("common.cancel")}
            >
                <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    maxLength={100}
                    autoFocus
                    autoComplete="new-password"
                    aria-label={t("settings.passwordDialogTitle")}
                    placeholder={t("settings.passwordPlaceholder")}
                    className={`${fieldClassName} w-full`}
                />
            </FormDialog>

            <ConfirmDialog
                isOpen={clearingPassword}
                title={t("settings.clearPasswordTitle")}
                message={t("settings.clearPasswordMessage")}
                onApprove={() => handlePassword("")}
                onDenied={() => setClearingPassword(false)}
                approveLabel={t("settings.clear")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />

            <FormDialog
                isOpen={releasesOpen}
                title={t("settings.releasesTitle")}
                onClose={() => setReleasesOpen(false)}
                onSubmit={handleUpload}
                loading={busy}
                submitLabel={t("settings.upload")}
                cancelLabel={t("common.close")}
                maxWidthClassName="max-w-2xl"
            >
                <label className="block">
                    <span className={fieldLabelClassName}>YevUsbAgent.exe</span>
                    <input type="file" accept=".exe" onChange={(event) => setExeFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </label>
                <input
                    value={releaseNote}
                    onChange={(event) => setReleaseNote(event.target.value)}
                    maxLength={255}
                    aria-label={t("common.note")}
                    placeholder={t("settings.notePlaceholder")}
                    className={`${fieldClassName} w-full`}
                />
                <div className="max-h-64 overflow-y-auto rounded-md border border-[#e0e3e5]">
                    <table className="min-w-full text-left text-sm">
                        <tbody>
                            {releases.length === 0 && (
                                <tr>
                                    <td className="px-3 py-3 text-center text-[#5e3f3a]">{t("settings.noReleases")}</td>
                                </tr>
                            )}
                            {releases.map((r) => (
                                <tr key={r.id} className="border-b border-[#f1f5f9] last:border-0">
                                    <td className="px-3 py-1.5 font-semibold text-[#191c1e]">
                                        {r.version}
                                        {r.version === saved?.targetVersion && (
                                            <span className="ml-2">
                                                <Badge variant="info">{t("settings.rolling")}</Badge>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs text-[#5e3f3a]">
                                        {[formatDateTime(r.uploadedAt), r.uploadedBy, formatBytes(r.sizeBytes), r.note].filter(Boolean).join(" · ")}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setDeleting(r)}
                                            disabled={busy || r.version === saved?.targetVersion}
                                            title={t("common.delete")}
                                            aria-label={t("settings.deleteReleaseAria", { version: r.version })}
                                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </FormDialog>

            <ConfirmDialog
                isOpen={deleting !== null}
                title={t("settings.deleteReleaseTitle")}
                message={t("settings.deleteReleaseMessage", { version: deleting?.version ?? "" })}
                onApprove={handleDelete}
                onDenied={() => setDeleting(null)}
                approveLabel={t("common.delete")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />
        </section>
    );
}
