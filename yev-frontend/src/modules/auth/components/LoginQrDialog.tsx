"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Printer, QrCode, RefreshCw, ShieldOff, X } from "lucide-react";
import QRCode from "qrcode";

import { LoginQrApi } from "@/modules/auth/api/login-qr.api";
import type { LoginQrLogAction, LoginQrLogDto, LoginQrStatusDto, UserDto } from "@/modules/auth/types/auth.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface Props {
    isOpen: boolean;
    user: UserDto | null;
    // Active QR code of the user, null if none.
    status: LoginQrStatusDto | null;
    onClose: () => void;
    // Called after create/revoke so the parent reloads the status.
    onChanged: () => void;
}

const ACTION_LABELS: Record<LoginQrLogAction, string> = {
    Created: "Tạo mã",
    Revoked: "Thu hồi mã",
    LoginSuccess: "Đăng nhập thành công",
    LoginFailed: "Đăng nhập thất bại",
};

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export default function LoginQrDialog({ isOpen, user, status, onClose, onChanged }: Props) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [logs, setLogs] = useState<LoginQrLogDto[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);

    // The raw code exists only right after creation, so reopening drops the old QR image.
    useDialogReset(isOpen, user, () => {
        setQrDataUrl(null);
        setLogs([]);
    });

    const userId = user?.id ?? null;
    const { isLoading: isLoadingLogs, refetch: refetchLogs } = useFetchEffect(
        () => (isOpen && userId !== null ? LoginQrApi.getLogs(userId) : Promise.resolve([] as LoginQrLogDto[])),
        [isOpen, userId],
        setLogs,
        "Không tải được nhật ký mã QR."
    );

    if (!isOpen || !user) return null;

    const busy = isGenerating || isRevoking;
    const displayName = user.fullName || user.userName;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const generated = await LoginQrApi.generate(user.id);
            setQrDataUrl(await QRCode.toDataURL(generated.qrPayload, { margin: 2, width: 320, errorCorrectionLevel: "M" }));
            toast.success("Đã tạo mã QR đăng nhập.");
            onChanged();
            void refetchLogs();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Tạo mã QR thất bại."));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async () => {
        setIsRevoking(true);
        try {
            await LoginQrApi.revoke(user.id);
            setQrDataUrl(null);
            toast.success("Đã thu hồi mã QR đăng nhập.");
            onChanged();
            void refetchLogs();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Thu hồi mã QR thất bại."));
        } finally {
            setIsRevoking(false);
        }
    };

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const printWindow = window.open("", "_blank", "width=600,height=800");
        if (!printWindow) {
            toast.error("Không thể mở cửa sổ in. Vui lòng cho phép cửa sổ bật lên (popup).");
            return;
        }
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Mã QR đăng nhập</title>
<style>
  body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; color: #191c1e; }
  .card { width: 300px; margin: 0 auto; border: 1px solid #191c1e; border-radius: 8px; padding: 16px; text-align: center; }
  .brand { font-size: 12px; font-weight: 700; letter-spacing: .15em; color: #e3000f; }
  .name { margin-top: 8px; font-size: 16px; font-weight: 700; }
  .user { font-size: 12px; color: #5e3f3a; }
  img { width: 260px; height: 260px; margin-top: 8px; }
  .note { margin-top: 8px; font-size: 11px; color: #5e3f3a; }
  @page { margin: 12mm; }
</style></head><body>
<div class="card">
  <div class="brand">YEV SCAN</div>
  <div class="name">${escapeHtml(displayName)}</div>
  <div class="user">${escapeHtml(user.userName)}</div>
  <img src="${qrDataUrl}" alt="QR" />
  <div class="note">Mã đăng nhập cá nhân — giữ kín như mật khẩu.</div>
</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
        printWindow.document.close();
        printWindow.focus();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/60 backdrop-blur-sm">
            <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">Mã QR đăng nhập</h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            {displayName} — {user.userName}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-xs text-[#930006]">
                        Ai có mã này đều đăng nhập được tài khoản này, không cần mật khẩu. Hãy giữ kín.
                    </div>

                    {qrDataUrl ? (
                        <div className="flex flex-col items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrDataUrl} alt="Mã QR đăng nhập" className="h-64 w-64 rounded-lg border border-[#e0e3e5]" />
                            <p className="text-center text-xs text-[#5e3f3a]">
                                Mã chỉ hiện một lần — hãy in ngay.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#191c1e]">
                            {status ? (
                                <>
                                    <p className="font-semibold">Đang có mã QR hoạt động</p>
                                    <p className="mt-1 text-xs text-[#5e3f3a]">
                                        Tạo {formatDateTime(status.createdAt)} · đã dùng {status.useCount} lần
                                        {status.lastUsedAt ? ` · gần nhất ${formatDateTime(status.lastUsedAt)}` : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-[#5e3f3a]">Cần in lại thì tạo mã mới (mã cũ mất hiệu lực).</p>
                                </>
                            ) : (
                                <p className="font-semibold">Chưa có mã QR đăng nhập.</p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={busy}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {status || qrDataUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
                            {isGenerating ? "Đang tạo..." : status || qrDataUrl ? "Tạo mã mới" : "Tạo mã QR"}
                        </button>
                        {qrDataUrl && (
                            <button
                                type="button"
                                onClick={handlePrint}
                                disabled={busy}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                In mã QR
                            </button>
                        )}
                        {(status || qrDataUrl) && (
                            <button
                                type="button"
                                onClick={handleRevoke}
                                disabled={busy}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e9bcb6] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ShieldOff className="h-3.5 w-3.5" />
                                {isRevoking ? "Đang thu hồi..." : "Thu hồi"}
                            </button>
                        )}
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Nhật ký (50 mục gần nhất)
                        </h4>
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-[#e0e3e5]">
                            {isLoadingLogs ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                            ) : logs.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">Chưa có hoạt động nào.</div>
                            ) : (
                                <ul className="divide-y divide-[#e0e3e5]">
                                    {logs.map((log) => (
                                        <li key={log.id} className="px-4 py-2.5 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`font-semibold ${
                                                        log.action === "LoginFailed" ? "text-[#930006]" : "text-[#191c1e]"
                                                    }`}
                                                >
                                                    {ACTION_LABELS[log.action] ?? log.action}
                                                </span>
                                                <span className="text-[#8a8f94]">{formatDateTime(log.createdAt)}</span>
                                            </div>
                                            <div className="mt-0.5 text-[#5e3f3a]">
                                                {log.actorName ? `Bởi ${log.actorName}` : null}
                                                {log.ipAddress ? `${log.actorName ? " · " : ""}IP ${log.ipAddress}` : null}
                                                {log.note ? ` · ${log.note}` : null}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
