"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { CheckCircle2, Circle, Loader2, X, XCircle } from "lucide-react";

import { InventoryApi } from "@/modules/pc-management/api/inventory.api";
import type { InventorySessionDto } from "@/modules/pc-management/types/inventory.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface InventorySessionDetailDialogProps {
    sessionId: number | null;
    onClose: () => void;
}

function ItemStatusIcon({ status }: { status: number }) {
    if (status === 1) return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1a7f37]" />;
    if (status === 2) return <XCircle className="h-4 w-4 shrink-0 text-[#930006]" />;
    return <Circle className="h-4 w-4 shrink-0 text-[#8a8f94]" />;
}

export default function InventorySessionDetailDialog({ sessionId, onClose }: InventorySessionDetailDialogProps) {
    const t = useTranslations("Asset.Inventory");
    const tCommon = useTranslations("Common");
    const [session, setSession] = useState<InventorySessionDto | null>(null);

    const { isLoading } = useFetchEffect(
        () => {
            if (sessionId === null) return Promise.resolve(null);
            return InventoryApi.getById(sessionId);
        },
        [sessionId],
        (data) => setSession(data),
        t("loadDetailError"),
        (message) => toast.error(message)
    );

    if (sessionId === null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div role="dialog" aria-modal="true" className="z-60 mx-4 flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">{t("detailDialogTitle")}</h3>
                    <button type="button" onClick={onClose} className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]" aria-label={tCommon("close")}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {isLoading || !session ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-[#5e3f3a]" />
                        </div>
                    ) : (
                        <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                            {session.items.map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-[#191c1e]">
                                            {item.deviceCode} - {item.deviceName}
                                        </div>
                                        {item.note && <div className="text-xs text-[#8a8f94]">{item.note}</div>}
                                    </div>
                                    <ItemStatusIcon status={item.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
