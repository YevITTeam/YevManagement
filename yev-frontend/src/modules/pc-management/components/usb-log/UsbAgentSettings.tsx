"use client";

import { useState, type ReactNode } from "react";
import { Eraser, Package, Settings, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { Badge } from "@/components/ui/Badge";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbAgentReleaseDto, UsbAgentSettingDto } from "@/modules/pc-management/types/usb-log.dto";
import { IconButton, fieldClassName } from "./UsbListToolbar";
import { formatBytes, formatDateTime } from "./usb-log-format";

const linkButtonClassName = "cursor-pointer text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50";

// One config row (DESIGN_SYSTEM §4.7): name on the left, long explanation behind the info icon.
function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
            <span className="flex w-48 shrink-0 items-center gap-1.5 text-sm font-medium text-[#191c1e]">
                {label}
                {hint && <InfoTooltip text={hint} />}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

// Fleet-wide agent tools behind toolbar icons: list clean-up, settings (copy-in log, sync, auto clean-up, password, auto-update) and agent builds.
export default function UsbAgentSettings({ canEdit, onPurged }: { canEdit: boolean; onPurged: () => void }) {
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

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [clearingPassword, setClearingPassword] = useState(false);

    const [releasesOpen, setReleasesOpen] = useState(false);
    const [exeFile, setExeFile] = useState<File | null>(null);
    const [releaseNote, setReleaseNote] = useState("");
    const [deleting, setDeleting] = useState<UsbAgentReleaseDto | null>(null);

    const [purgeOpen, setPurgeOpen] = useState(false);
    const [purgeUninstalled, setPurgeUninstalled] = useState(true);
    const [purgeOffline, setPurgeOffline] = useState(false);
    const [offlineDays, setOfflineDays] = useState(30);

    const apply =(result: UsbAgentSettingDto) => {
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
    const locked = !canEdit || saved === null;

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

    // Closing without saving drops the edits so the dialog reopens on the stored values.
    const closeSettings = () => {
        if (saved) apply(saved);
        setSettingsOpen(false);
    };

    const handleSave = () => {
        if (!canEdit || !dirty) return closeSettings();
        return run(async () => {
            apply(
                await UsbLogApi.updateAgentSetting({
                    trackCopyIn,
                    targetVersion: targetVersion || null,
                    updateMachines: updateMachines.trim() || null,
                    syncSeconds: Number(syncSeconds),
                    purgeUninstalledDays: purgeDays ? Number(purgeDays) : null,
                })
            );
            setSettingsOpen(false);
            toast.success(t("settings.saveSuccess"));
        }, t("settings.saveFailed"));
    };

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

    const handlePurge = () => {
        if (!purgeUninstalled && !purgeOffline) {
            toast.error(t("agents.purgeSelectType"));
            return;
        }
        return run(async () => {
            const count = await UsbLogApi.purgeAgents({ uninstalled: purgeUninstalled, offlineDays: purgeOffline ? offlineDays : null });
            setPurgeOpen(false);
            toast.success(t("agents.purgeSuccess", { count }));
            onPurged();
        }, t("agents.purgeFailed"));
    };

    const versionOptions = [{ value: "", label: t("settings.noAutoUpdate") }, ...releases.map((r) => ({ value: r.version, label: r.version }))];

    return (
        <>
            {canEdit && <IconButton icon={Eraser} label={t("agents.purgeButtonTitle")} onClick={() => setPurgeOpen(true)} />}
            <IconButton icon={Settings} label={t("settings.title")} onClick={() => setSettingsOpen(true)} disabled={saved === null} />
            {canEdit && <IconButton icon={Package} label={t("settings.releasesButton", { count: releases.length })} onClick={() => setReleasesOpen(true)} />}

            <FormDialog
                isOpen={settingsOpen}
                title={t("settings.title")}
                onClose={closeSettings}
                onSubmit={handleSave}
                loading={busy}
                submitLabel={canEdit ? t("common.save") : t("common.close")}
                cancelLabel={t("common.cancel")}
                maxWidthClassName="max-w-xl"
            >
                <div className="divide-y divide-[#f1f5f9]">
                    <SettingRow label={t("settings.trackCopyIn")} hint={t("settings.trackCopyInTitle")}>
                        <input
                            type="checkbox"
                            checked={trackCopyIn}
                            disabled={locked}
                            onChange={(event) => setTrackCopyIn(event.target.checked)}
                            aria-label={t("settings.trackCopyIn")}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                    </SettingRow>
                    <SettingRow label={t("settings.syncSeconds")} hint={t("settings.syncTitle")}>
                        <input
                            type="number"
                            min={15}
                            max={600}
                            value={syncSeconds}
                            onChange={(event) => setSyncSeconds(event.target.value)}
                            disabled={locked}
                            aria-label={t("settings.syncSeconds")}
                            className={`${fieldClassName} w-24`}
                        />
                        <span className="text-xs text-[#8a8f94]">{t("settings.seconds")}</span>
                    </SettingRow>
                    <SettingRow label={t("settings.purgeAfter")} hint={t("settings.purgeAfterTitle")}>
                        <input
                            type="number"
                            min={1}
                            max={3650}
                            value={purgeDays}
                            onChange={(event) => setPurgeDays(event.target.value)}
                            disabled={locked}
                            placeholder={t("settings.purgeNever")}
                            aria-label={t("settings.daysAria")}
                            className={`${fieldClassName} w-24`}
                        />
                        <span className="text-xs text-[#8a8f94]">{t("settings.days")}</span>
                    </SettingRow>
                    <SettingRow label={t("settings.autoUpdate")}>
                        <div className="w-44">
                            <StyledSelect
                                value={targetVersion}
                                onChange={setTargetVersion}
                                options={versionOptions}
                                disabled={locked}
                                ariaLabel={t("settings.autoUpdate")}
                                triggerClassName={`${fieldClassName} w-full pr-8`}
                            />
                        </div>
                        {targetVersion && (
                            <input
                                value={updateMachines}
                                onChange={(event) => setUpdateMachines(event.target.value)}
                                disabled={!canEdit}
                                placeholder={t("settings.pilotPlaceholder")}
                                title={t("settings.pilotTitle")}
                                aria-label={t("settings.pilotMachines")}
                                className={`${fieldClassName} w-full`}
                            />
                        )}
                    </SettingRow>
                    <SettingRow label={t("settings.password")} hint={t("settings.passwordTitle")}>
                        {saved && <Badge variant={saved.hasUninstallPassword ? "success" : "neutral"}>{saved.hasUninstallPassword ? t("settings.passwordIsSet") : t("settings.passwordNotSet")}</Badge>}
                        {canEdit && saved && (
                            <>
                                <button type="button" onClick={() => setPasswordOpen(true)} disabled={busy} className={linkButtonClassName}>
                                    {saved.hasUninstallPassword ? t("settings.change") : t("settings.set")}
                                </button>
                                {saved.hasUninstallPassword && (
                                    <button type="button" onClick={() => setClearingPassword(true)} disabled={busy} className={`${linkButtonClassName} text-[#930006]! hover:text-[#e3000f]!`}>
                                        {t("settings.clear")}
                                    </button>
                                )}
                            </>
                        )}
                    </SettingRow>
                </div>
            </FormDialog>

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
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="file"
                        accept=".exe"
                        onChange={(event) => setExeFile(event.target.files?.[0] ?? null)}
                        aria-label="YevUsbAgent.exe"
                        className="block text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-[#e0e3e5] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#191c1e] hover:file:bg-[#f2f4f6]"
                    />
                    <input
                        value={releaseNote}
                        onChange={(event) => setReleaseNote(event.target.value)}
                        maxLength={255}
                        aria-label={t("common.note")}
                        placeholder={t("settings.notePlaceholder")}
                        className={`${fieldClassName} min-w-0 flex-1`}
                    />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#e0e3e5]">
                    <table className="min-w-full text-left text-sm">
                        <tbody>
                            {releases.length === 0 && (
                                <tr>
                                    <td className="px-3 py-3 text-center text-[#8a8f94]">{t("settings.noReleases")}</td>
                                </tr>
                            )}
                            {releases.map((r) => (
                                <tr key={r.id} className="border-b border-[#f1f5f9] last:border-0">
                                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-[#191c1e]">
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
                                    <td className="px-2 py-1 text-right">
                                        <IconButton
                                            icon={Trash2}
                                            label={t("settings.deleteReleaseAria", { version: r.version })}
                                            size="sm"
                                            variant="danger"
                                            onClick={() => setDeleting(r)}
                                            disabled={busy || r.version === saved?.targetVersion}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </FormDialog>

            <FormDialog
                isOpen={purgeOpen}
                title={t("agents.purgeTitle")}
                onClose={() => setPurgeOpen(false)}
                onSubmit={handlePurge}
                loading={busy}
                submitLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
            >
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                    <input type="checkbox" checked={purgeUninstalled} onChange={(event) => setPurgeUninstalled(event.target.checked)} className="h-4 w-4 accent-[#e3000f]" />
                    {t("agents.purgeUninstalled")}
                </label>
                <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm text-[#191c1e]">
                    <input type="checkbox" checked={purgeOffline} onChange={(event) => setPurgeOffline(event.target.checked)} className="h-4 w-4 accent-[#e3000f]" />
                    {t("agents.purgeOffline")}
                    <input
                        type="number"
                        min={1}
                        max={3650}
                        value={offlineDays}
                        onChange={(event) => setOfflineDays(Number(event.target.value))}
                        aria-label={t("agents.offlineDaysAria")}
                        className={`${fieldClassName} w-20`}
                    />
                    {t("agents.purgeOfflineDays")}
                </label>
                <p className="text-xs text-[#5e3f3a]">{t("agents.purgeNote")}</p>
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
        </>
    );
}
