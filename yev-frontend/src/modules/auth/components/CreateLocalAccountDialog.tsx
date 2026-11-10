"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import FormDialog from "@/components/common/FormDialog";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { LocalAccountApi } from "@/modules/auth/api/local-account.api";
import { dialogInputClassName, dialogLabelClassName, MIN_PASSWORD_LENGTH } from "@/modules/auth/lib/localAccount";
import type { RoleDto } from "@/modules/auth/types/auth.dto";
import type { LocalAccountPrefixDto } from "@/modules/auth/types/local-account.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface Props {
    roles: RoleDto[];
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateLocalAccountDialog({ roles, onClose, onCreated }: Props) {
    const t = useTranslations("LocalAccount");
    const [prefixes, setPrefixes] = useState<LocalAccountPrefixDto[]>([]);
    const [prefixId, setPrefixId] = useState<number | "">("");
    const [loginName, setLoginName] = useState("");
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useFetchEffect(
        () => LocalAccountApi.getPrefixes(),
        [],
        (data) => {
            setPrefixes(data);
            setPrefixId(data[0]?.id ?? "");
        },
        t("loadFailed")
    );

    const toggleRole = (roleId: number, checked: boolean) => {
        setRoleIds((current) => (checked ? [...current, roleId] : current.filter((id) => id !== roleId)));
    };

    const handleSubmit = async () => {
        if (prefixId === "") {
            toast.error(t("needPrefix"));
            return;
        }
        if (!loginName.trim() || !fullName.trim()) {
            toast.error(t("needFields"));
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            toast.error(t("passwordTooShort"));
            return;
        }

        setIsSaving(true);
        try {
            const created = await LocalAccountApi.create({
                prefixId,
                loginName: loginName.trim(),
                fullName: fullName.trim(),
                password,
                email: email.trim() || undefined,
                roleIds,
            });
            toast.success(t("created", { userName: created.userName }));
            onCreated();
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
            title={t("createTitle")}
            onClose={onClose}
            onSubmit={handleSubmit}
            loading={isSaving}
            submitLabel={t("create")}
            cancelLabel={t("cancel")}
            maxWidthClassName="max-w-md"
        >
            <div>
                <span className={dialogLabelClassName}>
                    {t("userName")}
                    <RequiredMark />
                </span>
                <div className="flex items-center gap-2">
                    <div className="w-36 shrink-0">
                        <SearchableSelect
                            value={prefixId}
                            onChange={setPrefixId}
                            placeholder={t("prefix")}
                            options={prefixes.map((item) => ({
                                value: item.id,
                                label: item.prefix,
                                searchText: item.prefix.toLowerCase(),
                            }))}
                        />
                    </div>
                    <span className="text-sm font-semibold text-[#5e3f3a]">\</span>
                    <input
                        value={loginName}
                        onChange={(event) => setLoginName(event.target.value)}
                        disabled={isSaving}
                        maxLength={50}
                        autoComplete="off"
                        aria-label={t("userName")}
                        placeholder={t("loginNamePlaceholder")}
                        className={dialogInputClassName}
                    />
                </div>
                {prefixes.length === 0 && <p className="mt-1 text-xs text-[#930006]">{t("noPrefix")}</p>}
            </div>

            <label className="block">
                <span className={dialogLabelClassName}>
                    {t("fullName")}
                    <RequiredMark />
                </span>
                <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={isSaving}
                    maxLength={100}
                    autoComplete="off"
                    className={dialogInputClassName}
                />
            </label>

            <label className="block">
                <span className={dialogLabelClassName}>
                    {t("password")}
                    <RequiredMark />
                </span>
                <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSaving}
                    maxLength={128}
                    autoComplete="off"
                    placeholder={t("passwordPlaceholder")}
                    className={dialogInputClassName}
                />
            </label>

            <label className="block">
                <span className={dialogLabelClassName}>{t("email")}</span>
                <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSaving}
                    maxLength={255}
                    autoComplete="off"
                    className={dialogInputClassName}
                />
            </label>

            <div>
                <span className={dialogLabelClassName} title={t("rolesHint")}>
                    {t("roles")}
                </span>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[#e0e3e5] p-3">
                    {roles.map((role) => (
                        <label key={role.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                            <input
                                type="checkbox"
                                checked={roleIds.includes(role.id)}
                                onChange={(event) => toggleRole(role.id, event.target.checked)}
                                disabled={isSaving}
                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                            />
                            {role.roleName}
                        </label>
                    ))}
                </div>
            </div>
        </FormDialog>
    );
}
