"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wifi, X, XCircle } from "lucide-react";

import { ServerCheckApi } from "@/modules/pc-management/api/server-check.api";
import type { NetworkPingResultDto, ServerCheckManualResultDto, ServerCheckSessionDto } from "@/modules/pc-management/types/server-check.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { getApiErrorMessage } from "@/lib/apiError";
import { toast } from "react-toastify";

interface ServerCheckEndSessionDialogProps {
    isOpen: boolean;
    session: ServerCheckSessionDto | null;
    onClose: () => void;
    onEnded: (session: ServerCheckSessionDto) => void;
}

const OK = 1;
const NG = 2;

export default function ServerCheckEndSessionDialog({ isOpen, session, onClose, onEnded }: ServerCheckEndSessionDialogProps) {
    const t = useTranslations("Asset.ServerCheck");
    const tCommon = useTranslations("Common");

    const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
    const [manualStatus, setManualStatus] = useState<Record<number, number>>({});
    const [manualNotes, setManualNotes] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [pinging, setPinging] = useState(false);
    const [pingResult, setPingResult] = useState<NetworkPingResultDto | null>(null);

    useDialogReset(isOpen, session, (current) => {
        setItemNotes({});
        setManualNotes({});
        setManualStatus(Object.fromEntries((current?.manualResults ?? []).map((m) => [m.manualItemId, OK])));
        setPingResult(null);
    });

    if (!isOpen || !session) return null;

    // Only scan-required devices can be "not scanned"; the others are resolved by ping on the server.
    const pendingItems = session.items.filter((item) => item.requiresScan && item.status === 0);
    const autoItemCount = session.items.filter((item) => !item.requiresScan && item.status === 0).length;
    const networkPingItems = session.manualResults.filter((m) => m.usesNetworkPing);
    const regularManualItems = session.manualResults.filter((m) => !m.usesNetworkPing);

    const handlePingNetwork = async () => {
        setPinging(true);
        try {
            const result = await ServerCheckApi.pingNetwork();
            setPingResult(result);

            const failedText = result.items
                .filter((i) => !i.reachable)
                .map((i) => `${i.deviceCode} (${i.ipAddress})`)
                .join(", ");

            setManualStatus((current) => {
                const next = { ...current };
                networkPingItems.forEach((m) => { next[m.manualItemId] = result.allReachable ? OK : NG; });
                return next;
            });
            setManualNotes((current) => {
                const next = { ...current };
                networkPingItems.forEach((m) => { next[m.manualItemId] = result.allReachable ? "" : failedText; });
                return next;
            });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("pingNetworkError")));
        } finally {
            setPinging(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            const result = await ServerCheckApi.end(session.id, {
                items: pendingItems.map((item) => ({ serverCheckItemId: item.id, note: itemNotes[item.id]?.trim() || undefined })),
                manualResults: session.manualResults.map((m) => ({
                    manualItemId: m.manualItemId,
                    status: manualStatus[m.manualItemId] ?? OK,
                    note: manualNotes[m.manualItemId]?.trim() || undefined,
                })),
            });
            onEnded(result);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("endError")));
        } finally {
            setSubmitting(false);
        }
    };

    const renderManualItemCard = (manual: ServerCheckManualResultDto) => {
        const status = manualStatus[manual.manualItemId] ?? OK;
        return (
            <div key={manual.manualItemId} className="rounded-lg border border-[#e0e3e5] p-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#191c1e]">{manual.manualItemName}</span>
                    <div className="flex shrink-0 gap-1.5">
                        <button
                            type="button"
                            onClick={() => setManualStatus((current) => ({ ...current, [manual.manualItemId]: OK }))}
                            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition ${status === OK ? "bg-[#1a7f37] text-white" : "bg-[#f1f5f9] text-[#5e3f3a]"
                                }`}
                        >
                            OK
                        </button>
                        <button
                            type="button"
                            onClick={() => setManualStatus((current) => ({ ...current, [manual.manualItemId]: NG }))}
                            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition ${status === NG ? "bg-[#930006] text-white" : "bg-[#f1f5f9] text-[#5e3f3a]"
                                }`}
                        >
                            NG
                        </button>
                    </div>
                </div>
                {status === NG && (
                    <input
                        value={manualNotes[manual.manualItemId] ?? ""}
                        onChange={(event) =>
                            setManualNotes((current) => ({ ...current, [manual.manualItemId]: event.target.value }))
                        }
                        placeholder={t("issueNotePlaceholder")}
                        className="mt-2 h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">{t("endDialogTitle")}</h3>
                    <button
                        type="button"
                        onClick={() => !submitting && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
                        {pendingItems.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">
                                    {t("pendingItemsTitle", { count: pendingItems.length })}
                                </h4>
                                <div className="space-y-3">
                                    {pendingItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] p-3">
                                            <div className="text-sm font-semibold text-[#191c1e]">
                                                {item.deviceCode} - {item.deviceName} ({item.categoryText})
                                            </div>
                                            <input
                                                value={itemNotes[item.id] ?? ""}
                                                onChange={(event) => setItemNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                                                placeholder={t("issueNotePlaceholder")}
                                                className="mt-2 h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {autoItemCount > 0 && (
                            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3 text-sm text-[#5e3f3a]">
                                {t("autoCheckNotice", { count: autoItemCount })}
                            </div>
                        )}

                        {networkPingItems.length > 0 && (
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-[#191c1e]">{t("networkPingSectionTitle")}</h4>
                                    <button
                                        type="button"
                                        onClick={handlePingNetwork}
                                        disabled={pinging}
                                        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#191c1e] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                                        {pinging ? t("pinging") : pingResult ? t("pingAgainButton") : t("pingNetworkButton")}
                                    </button>
                                </div>

                                {pingResult && (
                                    <div className="mb-3 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3 text-sm">
                                        <div className={`font-semibold ${pingResult.allReachable ? "text-[#1a7f37]" : "text-[#930006]"}`}>
                                            {t("pingSummary", { reachable: pingResult.reachableCount, total: pingResult.totalCount })}
                                        </div>
                                        {!pingResult.allReachable && (
                                            <ul className="mt-2 space-y-1">
                                                {pingResult.items.filter((i) => !i.reachable).map((i) => (
                                                    <li key={i.ipAddress} className="flex items-center gap-1.5 text-[#930006]">
                                                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                        {i.deviceCode} - {i.deviceName} ({i.ipAddress})
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-3">{networkPingItems.map(renderManualItemCard)}</div>
                            </div>
                        )}

                        {regularManualItems.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#191c1e]">{t("manualItemsTitle")}</h4>
                                <div className="space-y-3">{regularManualItems.map(renderManualItemCard)}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 border-t border-[#e0e3e5] px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? t("ending") : t("endConfirmSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
