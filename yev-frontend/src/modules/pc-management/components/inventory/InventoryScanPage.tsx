"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Building2, CheckCircle2, Circle, ClipboardCheck, Loader2, ShieldAlert, XCircle } from "lucide-react";

import { InventoryApi } from "@/modules/pc-management/api/inventory.api";
import { InventoryAssignmentApi } from "@/modules/pc-management/api/inventory-assignment.api";
import type { InventoryAssignmentDto, InventorySessionDto } from "@/modules/pc-management/types/inventory.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import InventoryEndSessionDialog from "./InventoryEndSessionDialog";

// Kiosk quét mã kiểm kê thiết bị theo xưởng (asset-module.md §1.22) — cùng khuôn ServerCheckScanPage
// nhưng KHÔNG chia theo category (kiểm kê quét toàn bộ Device, không riêng Server/Network/UPS/Máy lạnh)
// và nhiều user cùng được gán 1 xưởng có thể cùng thao tác trên 1 phiên chung.
export default function InventoryScanPage() {
    const t = useTranslations("Asset.Inventory");

    const [assignment, setAssignment] = useState<InventoryAssignmentDto | null>(null);
    const [session, setSession] = useState<InventorySessionDto | null>(null);
    const [starting, setStarting] = useState(false);
    const [scanValue, setScanValue] = useState("");
    const [scanning, setScanning] = useState(false);
    const [lastResult, setLastResult] = useState<{ text: string; ok: boolean } | null>(null);
    const [endDialogOpen, setEndDialogOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Xưởng KHÔNG cho người quét tự chọn — lấy từ phân công của Admin (asset-module.md §1.22); chưa
    // được phân công thì chặn hẳn, không gọi tiếp getCurrent.
    const { isLoading, error } = useFetchEffect(
        async () => {
            const mine = await InventoryAssignmentApi.getMine();
            if (!mine) return { assignment: null, session: null };
            const current = await InventoryApi.getCurrent();
            return { assignment: mine, session: current };
        },
        [],
        (result) => {
            setAssignment(result.assignment);
            setSession(result.session);
        },
        t("loadCurrentError"),
        (message) => toast.error(message)
    );

    useEffect(() => {
        if (session && session.status === 0) {
            inputRef.current?.focus();
        }
    }, [session]);

    const handleStart = async () => {
        setStarting(true);
        try {
            const result = await InventoryApi.start();
            setSession(result);
            toast.success(t("startSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("startError")));
        } finally {
            setStarting(false);
        }
    };

    const handleScanSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const code = scanValue.trim();
        if (!session || !code || scanning) return;

        setScanValue("");
        setScanning(true);
        try {
            const result = await InventoryApi.scan(session.id, code);
            setLastResult({ text: `${result.deviceCode} - ${result.deviceName}`, ok: true });
            // Dùng getCurrent() (quyền Scan) chứ KHÔNG getById() (quyền View) — role "Kiểm kê thiết bị"
            // chỉ có Scan, dùng getById ở đây sẽ 403 ngay sau lần quét đầu tiên.
            const refreshed = await InventoryApi.getCurrent();
            setSession(refreshed);
        } catch (err) {
            console.error(err);
            setLastResult({ text: getApiErrorMessage(err, t("scanError")), ok: false });
        } finally {
            setScanning(false);
            inputRef.current?.focus();
        }
    };

    const handleEnded = (updated: InventorySessionDto) => {
        setSession(updated);
        setEndDialogOpen(false);
        toast.success(t("endSuccess"));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-sm text-[#5e3f3a]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loading")}
            </div>
        );
    }

    if (error) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    if (!assignment) {
        return (
            <div className="mx-auto max-w-md space-y-4 py-12 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-[#930006]" />
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("noAssignmentTitle")}</h1>
                <p className="text-sm text-[#5e3f3a]">{t("noAssignmentHint")}</p>
            </div>
        );
    }

    const branchBadge = (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4f2] px-3 py-1 text-xs font-semibold text-[#e3000f]">
            <Building2 className="h-3.5 w-3.5" /> {t("assignedBranchLabel")}: {assignment.branchName}
        </div>
    );

    // Chưa có phiên InProgress của xưởng này.
    if (!session) {
        return (
            <div className="mx-auto max-w-md space-y-6 py-12 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-[#e3000f]" />
                {branchBadge}
                <div>
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("scanTitle")}</h1>
                    <p className="mt-2 text-sm text-[#5e3f3a]">{t("notStartedHint")}</p>
                </div>
                <button
                    onClick={handleStart}
                    disabled={starting}
                    className="cursor-pointer rounded-lg bg-[#e3000f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {starting ? t("starting") : t("startButton")}
                </button>
            </div>
        );
    }

    // Đã hoàn thành — khóa, không quét/kết thúc thêm được.
    if (session.status === 1) {
        return (
            <div className="mx-auto max-w-md space-y-4 py-12 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-[#1a7f37]" />
                {branchBadge}
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("completedTitle")}</h1>
                <p className="text-sm text-[#5e3f3a]">
                    {t("completedHint", { found: session.foundCount, total: session.totalCount, by: session.endedBy ?? "" })}
                </p>
            </div>
        );
    }

    const pendingCount = session.items.filter((item) => item.status === 0).length;

    return (
        <div className="mx-auto max-w-2xl space-y-6 pb-24">
            <div className="space-y-2">
                {branchBadge}
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("scanTitle")}</h1>
                <p className="mt-1 text-sm text-[#5e3f3a]">{t("scanHint")}</p>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-2">
                <input
                    ref={inputRef}
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    placeholder={t("scanInputPlaceholder")}
                    disabled={scanning}
                    autoFocus
                    className="h-14 w-full rounded-xl border-2 border-[#e3000f] bg-white px-4 text-lg font-semibold text-[#191c1e] outline-none transition focus:ring-4 focus:ring-[#ffe0e3] disabled:opacity-50"
                />
                {lastResult && (
                    <div
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${lastResult.ok ? "bg-[#e6f4ea] text-[#1a7f37]" : "bg-[#fff4f2] text-[#930006]"
                            }`}
                    >
                        {lastResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                        {lastResult.text}
                    </div>
                )}
            </form>

            <div className="flex items-center justify-between rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                <span className="font-semibold text-[#191c1e]">{t("progressLabel")}</span>
                <span className="font-semibold text-[#e3000f]">{session.foundCount}/{session.totalCount}</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white">
                <ul className="max-h-[50vh] divide-y divide-[#f1f5f9] overflow-y-auto">
                    {session.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#191c1e]">{item.deviceCode} - {item.deviceName}</div>
                                {item.scannedAt && (
                                    <div className="text-xs text-[#8a8f94]">{new Date(item.scannedAt).toLocaleTimeString("vi-VN")}</div>
                                )}
                            </div>
                            {item.status === 1 ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1a7f37]" />
                            ) : (
                                <Circle className="h-5 w-5 shrink-0 text-[#8a8f94]" />
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t border-[#e0e3e5] bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                    <span className="text-sm text-[#5e3f3a]">
                        {pendingCount > 0 ? t("pendingCountLabel", { count: pendingCount }) : t("allScannedLabel")}
                    </span>
                    <button
                        onClick={() => setEndDialogOpen(true)}
                        className="cursor-pointer rounded-lg bg-[#191c1e] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                        {t("endButton")}
                    </button>
                </div>
            </div>

            <InventoryEndSessionDialog
                isOpen={endDialogOpen}
                session={session}
                onClose={() => setEndDialogOpen(false)}
                onEnded={handleEnded}
            />
        </div>
    );
}
