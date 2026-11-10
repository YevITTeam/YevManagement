"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { LocalAccountApi } from "@/modules/auth/api/local-account.api";
import { dialogInputClassName } from "@/modules/auth/lib/localAccount";
import type { LocalAccountPrefixDto } from "@/modules/auth/types/local-account.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

export default function LocalAccountPrefixDialog({ onClose }: { onClose: () => void }) {
    const t = useTranslations("LocalAccount");
    const [prefixes, setPrefixes] = useState<LocalAccountPrefixDto[]>([]);
    const [prefix, setPrefix] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [deleting, setDeleting] = useState<LocalAccountPrefixDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, refetch } = useFetchEffect(() => LocalAccountApi.getPrefixes(), [], setPrefixes, t("loadFailed"));

    const handleAdd = async () => {
        if (!prefix.trim()) return;
        setIsSaving(true);
        try {
            await LocalAccountApi.createPrefix(prefix.trim());
            toast.success(t("prefixAdded"));
            setPrefix("");
            await refetch();
        } catch (error) {
            console.error(error);
            toast.error(getApiErrorMessage(error, t("saveFailed")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setIsDeleting(true);
        try {
            await LocalAccountApi.deletePrefix(deleting.id);
            toast.success(t("prefixDeleted"));
            setDeleting(null);
            await refetch();
        } catch (error) {
            console.error(error);
            toast.error(getApiErrorMessage(error, t("saveFailed")));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <FormDialog
                isOpen
                title={t("prefixTitle")}
                onClose={onClose}
                onSubmit={handleAdd}
                loading={isSaving}
                submitLabel={t("add")}
                cancelLabel={t("close")}
            >
                <input
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value.toUpperCase())}
                    disabled={isSaving}
                    maxLength={30}
                    autoFocus
                    aria-label={t("prefix")}
                    placeholder={t("prefixPlaceholder")}
                    className={dialogInputClassName}
                />

                <div className="max-h-60 divide-y divide-[#f1f5f9] overflow-y-auto rounded-lg border border-[#e0e3e5]">
                    {prefixes.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-[#5e3f3a]">{isLoading ? t("loading") : t("noPrefix")}</p>
                    ) : (
                        prefixes.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                                <span className="flex-1 text-sm font-semibold text-[#191c1e]">{item.prefix}</span>
                                <span className="whitespace-nowrap text-xs text-[#5e3f3a]">{t("accountCount", { count: item.accountCount })}</span>
                                <button
                                    type="button"
                                    onClick={() => setDeleting(item)}
                                    disabled={item.accountCount > 0}
                                    title={item.accountCount > 0 ? t("prefixInUse") : t("deletePrefix")}
                                    aria-label={t("deletePrefix")}
                                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:text-[#5e3f3a] disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </FormDialog>

            <ConfirmDialog
                isOpen={deleting !== null}
                title={t("deletePrefix")}
                message={<strong>{deleting?.prefix}</strong>}
                approveLabel={t("delete")}
                deniedLabel={t("cancel")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeleting(null);
                }}
            />
        </>
    );
}
