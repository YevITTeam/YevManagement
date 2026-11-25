"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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

// Fleet-wide agent options: copy-in logging, uninstall password and which signed build agents update to.
export default function UsbAgentSettings({ canEdit }: { canEdit: boolean }) {
    const [saved, setSaved] = useState<UsbAgentSettingDto | null>(null);
    const [trackCopyIn, setTrackCopyIn] = useState(false);
    const [targetVersion, setTargetVersion] = useState("");
    const [updateMachines, setUpdateMachines] = useState("");
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
    };

    useFetchEffect(
        () => Promise.all([UsbLogApi.getAgentSetting(), UsbLogApi.getReleases()]),
        [],
        ([setting, list]) => {
            apply(setting);
            setReleases(list);
        },
        "Không thể tải cài đặt agent.",
        (message) => toast.error(message)
    );

    const dirty =
        saved !== null &&
        (trackCopyIn !== saved.trackCopyIn || targetVersion !== (saved.targetVersion ?? "") || updateMachines.trim() !== (saved.updateMachines ?? ""));

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
            apply(await UsbLogApi.updateAgentSetting({ trackCopyIn, targetVersion: targetVersion || null, updateMachines: updateMachines.trim() || null }));
            toast.success("Đã lưu cài đặt agent.");
        }, "Lưu cài đặt agent thất bại.");

    const handlePassword = (value: string) =>
        run(async () => {
            await UsbLogApi.setUninstallPassword(value);
            if (saved) setSaved({ ...saved, hasUninstallPassword: value !== "" });
            toast.success(value ? "Đã đặt mật khẩu gỡ agent." : "Đã bỏ mật khẩu gỡ agent.");
            setPasswordOpen(false);
            setClearingPassword(false);
            setPassword("");
        }, "Lưu mật khẩu thất bại.");

    const handleUpload = () =>
        run(async () => {
            if (!exeFile) {
                toast.error("Chọn file YevUsbAgent.exe.");
                return;
            }
            const release = await UsbLogApi.uploadRelease(exeFile, releaseNote.trim());
            setReleases([release, ...releases]);
            setExeFile(null);
            setReleaseNote("");
            toast.success(`Đã tải lên bản ${release.version}.`);
        }, "Tải bản agent thất bại.");

    const handleDelete = () =>
        run(async () => {
            if (!deleting) return;
            await UsbLogApi.deleteRelease(deleting.id);
            setReleases(releases.filter((r) => r.id !== deleting.id));
            setDeleting(null);
            toast.success("Đã xoá bản agent.");
        }, "Xoá bản agent thất bại.");

    const versionOptions = [{ value: "", label: "Không tự cập nhật" }, ...releases.map((r) => ({ value: r.version, label: r.version }))];

    return (
        <section className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
            <label
                className="flex h-9 cursor-pointer items-center gap-2 text-sm text-[#191c1e]"
                title="Agent ghi lại file chép từ USB vào ổ cứng của máy (đoán theo kích thước và ngày sửa; không bắt được file mở thẳng trên USB hoặc giải nén)"
            >
                <input
                    type="checkbox"
                    checked={trackCopyIn}
                    disabled={!canEdit || saved === null}
                    onChange={(event) => setTrackCopyIn(event.target.checked)}
                    className="h-4 w-4 accent-[#e3000f]"
                />
                Log chép từ USB vào máy
            </label>

            <div className="flex h-9 items-center gap-2 text-sm text-[#191c1e]" title="Hỏi khi gỡ agent (bấm đúp hoặc --uninstall); Tanium truyền --password">
                Mật khẩu gỡ
                {saved && <Badge variant={saved.hasUninstallPassword ? "success" : "neutral"}>{saved.hasUninstallPassword ? "Đã đặt" : "Chưa đặt"}</Badge>}
                {canEdit && saved && (
                    <>
                        <button onClick={() => setPasswordOpen(true)} disabled={busy} className={linkButtonClassName}>
                            {saved.hasUninstallPassword ? "Đổi" : "Đặt"}
                        </button>
                        {saved.hasUninstallPassword && (
                            <button onClick={() => setClearingPassword(true)} disabled={busy} className={linkButtonClassName}>
                                Bỏ
                            </button>
                        )}
                    </>
                )}
            </div>

            <label className="block w-40">
                <span className={fieldLabelClassName}>Tự cập nhật lên</span>
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
                    <span className={fieldLabelClassName}>Máy nhận trước</span>
                    <input
                        value={updateMachines}
                        onChange={(event) => setUpdateMachines(event.target.value)}
                        disabled={!canEdit}
                        placeholder="Để trống = mọi máy"
                        title="Tên máy hoặc mã máy, cách nhau dấu phẩy. Chạy ổn trên các máy này rồi mới để trống cho mọi máy."
                        className={`${fieldClassName} w-full`}
                    />
                </label>
            )}
            {canEdit && (
                <button onClick={() => setReleasesOpen(true)} className={`${linkButtonClassName} h-9`}>
                    Bản agent ({releases.length})
                </button>
            )}
            {canEdit && dirty && (
                <button
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Lưu
                </button>
            )}

            <FormDialog
                isOpen={passwordOpen}
                title="Mật khẩu gỡ agent"
                onClose={() => setPasswordOpen(false)}
                onSubmit={() => (password.length >= 6 ? handlePassword(password) : toast.error("Mật khẩu tối thiểu 6 ký tự."))}
                loading={busy}
                submitLabel="Lưu"
                cancelLabel="Huỷ"
            >
                <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    maxLength={100}
                    autoFocus
                    autoComplete="new-password"
                    aria-label="Mật khẩu gỡ agent"
                    placeholder="Tối thiểu 6 ký tự"
                    className={`${fieldClassName} w-full`}
                />
            </FormDialog>

            <ConfirmDialog
                isOpen={clearingPassword}
                title="Bỏ mật khẩu gỡ"
                message="Ai có quyền Administrator trên máy cũng gỡ được agent mà không cần mật khẩu."
                onApprove={() => handlePassword("")}
                onDenied={() => setClearingPassword(false)}
                approveLabel="Bỏ"
                deniedLabel="Huỷ"
                loading={busy}
            />

            <FormDialog
                isOpen={releasesOpen}
                title="Bản agent"
                onClose={() => setReleasesOpen(false)}
                onSubmit={handleUpload}
                loading={busy}
                submitLabel="Tải lên"
                cancelLabel="Đóng"
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
                    aria-label="Ghi chú"
                    placeholder="Ghi chú thay đổi"
                    className={`${fieldClassName} w-full`}
                />
                <div className="max-h-64 overflow-y-auto rounded-md border border-[#e0e3e5]">
                    <table className="min-w-full text-left text-sm">
                        <tbody>
                            {releases.length === 0 && (
                                <tr>
                                    <td className="px-3 py-3 text-center text-[#5e3f3a]">Chưa có bản nào.</td>
                                </tr>
                            )}
                            {releases.map((r) => (
                                <tr key={r.id} className="border-b border-[#f1f5f9] last:border-0">
                                    <td className="px-3 py-1.5 font-semibold text-[#191c1e]">
                                        {r.version}
                                        {r.version === saved?.targetVersion && (
                                            <span className="ml-2">
                                                <Badge variant="info">Đang phát</Badge>
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
                                            title="Xoá"
                                            aria-label={`Xoá bản ${r.version}`}
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
                title="Xoá bản agent"
                message={`Xoá bản ${deleting?.version ?? ""} khỏi máy chủ?`}
                onApprove={handleDelete}
                onDenied={() => setDeleting(null)}
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={busy}
            />
        </section>
    );
}
