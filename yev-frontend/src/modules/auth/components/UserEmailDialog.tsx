"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Mail, Plus, Sparkles, Star, Trash2, X } from "lucide-react";

import { UserEmailApi } from "@/modules/auth/api/user-email.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import {
    USER_EMAIL_SOURCE,
    USER_EMAIL_SOURCE_LABELS,
    type UserEmailOverviewDto,
    type UserEmailSuggestionDto,
} from "@/modules/auth/types/user-email.dto";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface Props {
    isOpen: boolean;
    user: UserDto | null;
    onClose: () => void;
    // Called after every change so the parent reloads the primary email shown in its user list.
    onChanged: () => void;
}

// "Use the primary email" value in the per-module select (real email ids are always > 0).
const PRIMARY_OPTION = 0;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sectionLabelClassName = "text-xs font-medium text-[#5e3f3a]";
const iconButtonClassName =
    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40";

export default function UserEmailDialog({ isOpen, user, onClose, onChanged }: Props) {
    const [overview, setOverview] = useState<UserEmailOverviewDto | null>(null);
    const [moduleDraft, setModuleDraft] = useState<Record<string, number>>({});
    const [newEmail, setNewEmail] = useState("");
    const [suggestions, setSuggestions] = useState<UserEmailSuggestionDto[] | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);

    useDialogReset(isOpen, user, () => {
        setOverview(null);
        setModuleDraft({});
        setNewEmail("");
        setSuggestions(null);
    });

    const applyOverview = (data: UserEmailOverviewDto) => {
        setOverview(data);
        setModuleDraft(Object.fromEntries(data.modules.map((m) => [m.moduleCode, m.userEmailId ?? PRIMARY_OPTION])));
    };

    const userId = user?.id ?? null;
    const { isLoading } = useFetchEffect(
        () => (isOpen && userId !== null ? UserEmailApi.getOverview(userId) : Promise.resolve(null)),
        [isOpen, userId],
        (data) => {
            if (data) applyOverview(data);
        },
        "Không tải được danh sách email."
    );

    if (!isOpen || !user) return null;

    const busy = busyAction !== null;
    const emails = overview?.emails ?? [];
    const modules = overview?.modules ?? [];
    const emailKeys = new Set(emails.map((item) => item.email.toLowerCase()));
    const newSuggestions = (suggestions ?? []).filter((item) => !item.alreadyAdded && !emailKeys.has(item.email.toLowerCase()));

    // Runs one write: the BE returns the fresh overview, which replaces local state, then the parent reloads.
    const run = async (key: string, action: () => Promise<UserEmailOverviewDto>, successMessage: string, errorMessage: string) => {
        setBusyAction(key);
        try {
            applyOverview(await action());
            toast.success(successMessage);
            onChanged();
            return true;
        } catch (err) {
            toast.error(getApiErrorMessage(err, errorMessage));
            return false;
        } finally {
            setBusyAction(null);
        }
    };

    // The first address of an account becomes its primary email; later ones are starred by hand.
    const handleAdd = async () => {
        const email = newEmail.trim();
        if (!EMAIL_PATTERN.test(email)) {
            toast.warn("Email không hợp lệ.");
            return;
        }
        const ok = await run(
            "add",
            () => UserEmailApi.add(user.id, { email, source: USER_EMAIL_SOURCE.Manual, note: null, isPrimary: emails.length === 0 }),
            "Đã thêm email.",
            "Thêm email thất bại."
        );
        if (ok) setNewEmail("");
    };

    const handleAddSuggestion = (suggestion: UserEmailSuggestionDto) =>
        run(
            `suggest:${suggestion.email}`,
            () =>
                UserEmailApi.add(user.id, {
                    email: suggestion.email,
                    source: suggestion.source,
                    note: suggestion.note,
                    isPrimary: emails.length === 0,
                }),
            "Đã thêm email.",
            "Thêm email thất bại."
        );

    const handleLoadSuggestions = async () => {
        setBusyAction("suggestions");
        try {
            setSuggestions(await UserEmailApi.getSuggestions(user.id));
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không lấy được gợi ý email."));
        } finally {
            setBusyAction(null);
        }
    };

    // Each change is saved right away; a failed save puts the select back to the stored value.
    const handleModuleChange = async (moduleCode: string, value: number) => {
        const nextDraft = { ...moduleDraft, [moduleCode]: value };
        setModuleDraft(nextDraft);
        const ok = await run(
            `module:${moduleCode}`,
            () =>
                UserEmailApi.updateModules(user.id, {
                    items: modules.map((m) => ({
                        moduleCode: m.moduleCode,
                        userEmailId: nextDraft[m.moduleCode] === PRIMARY_OPTION ? null : nextDraft[m.moduleCode],
                    })),
                }),
            "Đã lưu email nhận thông báo.",
            "Lưu email nhận thông báo thất bại."
        );
        if (!ok && overview) applyOverview(overview);
    };

    const moduleOptions = [
        { value: PRIMARY_OPTION, label: "Email chính" },
        ...emails.map((e) => ({ value: e.id, label: e.email })),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => !busy && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-email-dialog-title"
                className="z-60 flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-[#e0e3e5] px-6 py-4">
                    <div className="min-w-0">
                        <h3 id="user-email-dialog-title" className="text-lg font-semibold text-[#191c1e]">
                            Email người dùng
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-[#5e3f3a]">
                            {user.fullName || user.userName}
                            <span className="text-[#8a8f94]"> · {user.userName}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    <section>
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={sectionLabelClassName}>Email{emails.length > 0 && ` (${emails.length})`}</span>
                            {overview && emails.length === 0 && (
                                <span
                                    className="inline-flex items-center gap-1.5 text-xs text-[#9a5b00]"
                                    title="Hệ thống không gửi được mail cho người này khi chưa có email"
                                >
                                    <span className="size-1.5 rounded-full bg-amber-500" />
                                    Chưa có email
                                </span>
                            )}
                            <span className="flex-1" />
                            <button
                                type="button"
                                onClick={() => void handleLoadSuggestions()}
                                disabled={busy}
                                title="Tìm email của tài khoản này trên AD (mail và alias)"
                                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#e3000f] transition hover:text-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                {busyAction === "suggestions" ? "Đang tìm..." : "Gợi ý từ AD"}
                            </button>
                        </div>

                        <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                            {isLoading && !overview && <li className="px-3 py-3 text-sm text-[#8a8f94]">Đang tải...</li>}

                            {emails.map((item) => {
                                const isLockedPrimary = item.isPrimary && emails.length > 1;
                                return (
                                    <li key={item.id} className="group flex items-center gap-1 px-1.5 py-1">
                                        {item.isPrimary ? (
                                            <span className="flex size-8 shrink-0 items-center justify-center text-[#e3000f]" title="Email chính">
                                                <Star className="h-4 w-4 fill-current" />
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    run(`primary:${item.id}`, () => UserEmailApi.setPrimary(user.id, item.id), "Đã đặt email chính.", "Đặt email chính thất bại.")
                                                }
                                                disabled={busy}
                                                title="Đặt làm email chính"
                                                aria-label="Đặt làm email chính"
                                                className={`${iconButtonClassName} text-[#c9cdd1] hover:bg-[#fff4f2] hover:text-[#e3000f]`}
                                            >
                                                <Star className="h-4 w-4" />
                                            </button>
                                        )}
                                        <div className="min-w-0 flex-1 px-1.5">
                                            <p className="truncate text-sm font-medium text-[#191c1e]" title={item.email}>
                                                {item.email}
                                            </p>
                                            {item.note && <p className="truncate text-xs text-[#8a8f94]">{item.note}</p>}
                                        </div>
                                        <span className="shrink-0 px-1 text-xs text-[#8a8f94]">
                                            {USER_EMAIL_SOURCE_LABELS[item.source] ?? item.source}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => run(`delete:${item.id}`, () => UserEmailApi.remove(user.id, item.id), "Đã xoá email.", "Xoá email thất bại.")}
                                            disabled={busy || isLockedPrimary}
                                            title={isLockedPrimary ? "Chọn email chính khác trước khi xoá" : "Xoá email"}
                                            aria-label="Xoá email"
                                            className={`${iconButtonClassName} text-[#8a8f94] hover:bg-[#fff4f2] hover:text-[#930006] disabled:hover:bg-transparent disabled:hover:text-[#8a8f94]`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </li>
                                );
                            })}

                            {newSuggestions.map((item) => (
                                <li key={`suggest-${item.email}`} className="flex items-center gap-1 bg-[#f8fafc] px-1.5 py-1">
                                    <span className="flex size-8 shrink-0 items-center justify-center text-[#c9cdd1]">
                                        <Mail className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1 px-1.5">
                                        <p className="truncate text-sm text-[#5e3f3a]" title={item.email}>
                                            {item.email}
                                        </p>
                                        {item.note && <p className="truncate text-xs text-[#8a8f94]">{item.note}</p>}
                                    </div>
                                    <span className="shrink-0 px-1 text-xs text-[#8a8f94]">
                                        {USER_EMAIL_SOURCE_LABELS[item.source] ?? item.source}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleAddSuggestion(item)}
                                        disabled={busy}
                                        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-[#e3000f] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Thêm
                                    </button>
                                </li>
                            ))}
                            {suggestions !== null && newSuggestions.length === 0 && (
                                <li className="bg-[#f8fafc] px-3 py-2 text-xs text-[#8a8f94]">Không có gợi ý mới từ AD.</li>
                            )}

                            <li className="flex items-center gap-1 px-1.5 py-1">
                                <span className="flex size-8 shrink-0 items-center justify-center text-[#8a8f94]">
                                    <Plus className="h-4 w-4" />
                                </span>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void handleAdd();
                                        }
                                    }}
                                    placeholder="Thêm email rồi nhấn Enter"
                                    aria-label="Thêm email"
                                    disabled={busy}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm text-[#191c1e] outline-none transition hover:border-[#e0e3e5] focus:border-[#e3000f] focus:bg-white focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed"
                                />
                                {newEmail.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => void handleAdd()}
                                        disabled={busy}
                                        className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md bg-[#e3000f] px-3 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {busyAction === "add" ? "Đang thêm..." : "Thêm"}
                                    </button>
                                )}
                            </li>
                        </ul>
                    </section>

                    {modules.length > 0 && (
                        <section>
                            <p className={`mb-2 ${sectionLabelClassName}`} title="Mỗi module gửi mail về email được chọn; để Email chính thì gửi về email chính.">
                                Nhận thông báo theo module
                            </p>
                            <ul className="divide-y divide-[#f1f5f9] rounded-lg border border-[#e0e3e5]">
                                {modules.map((m) => (
                                    <li key={m.moduleCode} className="flex items-center gap-3 py-1.5 pl-3 pr-1.5">
                                        <span
                                            className={`min-w-0 flex-1 truncate text-sm ${m.isApplied ? "text-[#191c1e]" : "text-[#8a8f94]"}`}
                                            title={m.isApplied ? undefined : "Module này chưa đọc cấu hình email — lưu sẵn, chưa có tác dụng"}
                                        >
                                            {m.moduleName}
                                            {!m.isApplied && <span className="ml-2 text-xs text-[#9a5b00]">Chưa áp dụng</span>}
                                        </span>
                                        <div className="w-60 shrink-0">
                                            <StyledSelect
                                                options={moduleOptions}
                                                value={moduleDraft[m.moduleCode] ?? PRIMARY_OPTION}
                                                onChange={(value) => void handleModuleChange(m.moduleCode, value)}
                                                disabled={busy || emails.length === 0}
                                                ariaLabel={`Email nhận cho ${m.moduleName}`}
                                                triggerClassName="h-8 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-60"
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
