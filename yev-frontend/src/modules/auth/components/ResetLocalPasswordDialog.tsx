"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import FormDialog from "@/components/common/FormDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { LocalAccountApi } from "@/modules/auth/api/local-account.api";
import { dialogInputClassName, dialogLabelClassName, MIN_PASSWORD_LENGTH } from "@/modules/auth/lib/localAccount";
import type { UserDto } from "@/modules/auth/types/auth.dto";

export default function ResetLocalPasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
    const t = useTranslations("LocalAccount");
    const [password, setPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (password.length < MIN_PASSWORD_LENGTH) {
            toast.error(t("passwordTooShort"));
            return;
        }

        setIsSaving(true);
        try {
            await LocalAccountApi.resetPassword(user.id, password);
            toast.success(t("resetDone", { userName: user.userName }));
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(getApiErrorMessage(error, t("saveFailed")));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <FormDialog
            isOpen
            title={t("resetTitle")}
            onClose={onClose}
            onSubmit={handleSubmit}
            loading={isSaving}
            submitLabel={t("save")}
            cancelLabel={t("cancel")}
        >
            <p className="text-sm font-semibold text-[#191c1e]">{user.fullName || user.userName}</p>
            <label className="block">
                <span className={dialogLabelClassName}>{t("newPassword")}</span>
                <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSaving}
                    maxLength={128}
                    autoFocus
                    autoComplete="off"
                    placeholder={t("passwordPlaceholder")}
                    className={dialogInputClassName}
                />
            </label>
        </FormDialog>
    );
}
