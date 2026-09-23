"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { X } from "lucide-react";

import { InventoryApi } from "@/modules/pc-management/api/inventory.api";
import type { InventorySessionDto } from "@/modules/pc-management/types/inventory.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { getApiErrorMessage } from "@/lib/apiError";

interface InventoryEndSessionDialogProps {
    isOpen: boolean;
    session: InventorySessionDto | null;
    onClose: () => void;
    onEnded: (session: InventorySessionDto) => void;
}

// Kết thúc phiên kiểm kê: máy còn Pending bị ép thành Missing kèm ghi chú tự do (không có checklist lỗi
// dạng tick sẵn — cùng quyết định đơn giản hoá như ServerCheckEndSessionDialog). Khoá cứng sau khi gửi.
export default function InventoryEndSessionDialog({ isOpen, session, onClose, onEnded }: InventoryEndSessionDialogProps) {
    const t = useTranslations("Asset.Inventory");
    const tCommon = useTranslations("Common");

    const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useDialogReset(isOpen, session, () => {
        setItemNotes({});
    });

    if (!isOpen || !session) return null;

    const pendingItems = session.items.filter((item) => item.status === 0);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            const result = await InventoryApi.end(session.id, {
                items: pendingItems.map((item) => ({ inventorySessionItemId: item.id, note: itemNotes[item.id]?.trim() || undefined })),
            });
            onEnded(result);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("endError")));
        } finally {
            setSubmitting(false);
        }
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
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                        {pendingItems.length === 0 ? (
                            <p className="text-sm text-[#1a7f37]">{t("allFoundHint")}</p>
                        ) : (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">
                                    {t("pendingItemsTitle", { count: pendingItems.length })}
                                </h4>
                                <div className="space-y-3">
                                    {pendingItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] p-3">
                                            <div className="text-sm font-semibold text-[#191c1e]">
                                                {item.deviceCode} - {item.deviceName}
                                            </div>
                                            <input
                                                value={itemNotes[item.id] ?? ""}
                                                onChange={(event) => setItemNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                                                placeholder={t("missingNotePlaceholder")}
                                                className="mt-2 h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                            />
                                        </div>
                                    ))}
                                </div>
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
