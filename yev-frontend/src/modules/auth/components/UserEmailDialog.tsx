"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Plus, Save, Sparkles, Star, Trash2, X } from "lucide-react";

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
    // Gọi sau mỗi lần đổi để cha tải lại email chính trong danh sách user.
    onChanged: () => void;
}

// Giá trị "dùng email chính" trong ô chọn email theo module (id email thật luôn > 0).
const PRIMARY_OPTION = 0;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserEmailDialog({ isOpen, user, onClose, onChanged }: Props) {
    const [overview, setOverview] = useState<UserEmailOverviewDto | null>(null);
    const [moduleDraft, setModuleDraft] = useState<Record<string, number>>({});
    const [newEmail, setNewEmail] = useState("");
    const [newIsPrimary, setNewIsPrimary] = useState(false);
    const [suggestions, setSuggestions] = useState<UserEmailSuggestionDto[] | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);

    useDialogReset(isOpen, user, () => {
        setOverview(null);
        setModuleDraft({});
        setNewEmail("");
        setNewIsPrimary(false);
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
    const isModuleDirty = modules.some((m) => (m.userEmailId ?? PRIMARY_OPTION) !== moduleDraft[m.moduleCode]);

    // Chạy 1 thao tác ghi: BE trả overview mới → thay state, báo cha tải lại.
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

    const handleAdd = async () => {
        const email = newEmail.trim();
        if (!EMAIL_PATTERN.test(email)) {
            toast.warn("Email không hợp lệ.");
            return;
        }
        const ok = await run(
            "add",
            () => UserEmailApi.add(user.id, { email, source: USER_EMAIL_SOURCE.Manual, note: null, isPrimary: newIsPrimary }),
            "Đã thêm email.",
            "Thêm email thất bại."
        );
        if (ok) {
            setNewEmail("");
            setNewIsPrimary(false);
        }
    };

    const handleAddSuggestion = async (suggestion: UserEmailSuggestionDto) => {
        const ok = await run(
            `suggest:${suggestion.email}`,
            () =>
                UserEmailApi.add(user.id, {
                    email: suggestion.email,
                    source: suggestion.source,
                    note: suggestion.note,
                    isPrimary: false,
                }),
            "Đã thêm email từ đề xuất.",
            "Thêm email thất bại."
        );
        if (ok) {
            setSuggestions((prev) =>
                prev ? prev.map((x) => (x.email === suggestion.email ? { ...x, alreadyAdded: true } : x)) : prev
            );
        }
    };

    const handleLoadSuggestions = async () => {
        setBusyAction("suggestions");
        try {
            setSuggestions(await UserEmailApi.getSuggestions(user.id));
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không lấy được đề xuất email."));
        } finally {
            setBusyAction(null);
        }
    };

    const handleSaveModules = () =>
        run(
            "modules",
            () =>
                UserEmailApi.updateModules(user.id, {
                    items: modules.map((m) => ({
                        moduleCode: m.moduleCode,
                        userEmailId: moduleDraft[m.moduleCode] === PRIMARY_OPTION ? null : moduleDraft[m.moduleCode],
                    })),
                }),
            "Đã lưu email theo module.",
            "Lưu email theo module thất bại."
        );

    const moduleOptions = [
        { value: PRIMARY_OPTION, label: "Email chính (mặc định)" },
        ...emails.map((e) => ({ value: e.id, label: e.email })),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/60 backdrop-blur-sm">
            <div className="mx-4 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">Email người dùng</h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            {user.fullName || user.userName} — {user.userName}
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
                    <section>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Danh sách email</h4>
                        <div className="rounded-lg border border-[#e0e3e5]">
                            {isLoading && !overview ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                            ) : emails.length === 0 ? (
                                <div className="px-4 py-4 text-center text-sm text-[#930006]">
                                    Chưa có email — hệ thống không gửi được mail cho người này.
                                </div>
                            ) : (
                                <ul className="divide-y divide-[#e0e3e5]">
                                    {emails.map((item) => (
                                        <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="truncate text-sm font-semibold text-[#191c1e]">{item.email}</span>
                                                    {item.isPrimary && (
                                                        <span className="rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#930006]">
                                                            Chính
                                                        </span>
                                                    )}
                                                    <span className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-semibold text-[#5e3f3a]">
                                                        {USER_EMAIL_SOURCE_LABELS[item.source] ?? item.source}
                                                    </span>
                                                </div>
                                                {item.note && <p className="truncate text-xs text-[#8a8f94]">{item.note}</p>}
                                            </div>
                                            {!item.isPrimary && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        run(
                                                            `primary:${item.id}`,
                                                            () => UserEmailApi.setPrimary(user.id, item.id),
                                                            "Đã đặt email chính.",
                                                            "Đặt email chính thất bại."
                                                        )
                                                    }
                                                    disabled={busy}
                                                    title="Đặt làm email chính"
                                                    aria-label="Đặt làm email chính"
                                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Star className="h-4 w-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    run(
                                                        `delete:${item.id}`,
                                                        () => UserEmailApi.remove(user.id, item.id),
                                                        "Đã xoá email.",
                                                        "Xoá email thất bại."
                                                    )
                                                }
                                                disabled={busy || (item.isPrimary && emails.length > 1)}
                                                title={
                                                    item.isPrimary && emails.length > 1
                                                        ? "Chọn email chính khác trước khi xoá"
                                                        : "Xoá email"
                                                }
                                                aria-label="Xoá email"
                                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:text-[#5e3f3a] disabled:opacity-40 disabled:hover:bg-transparent"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleAdd();
                                }}
                                placeholder="ten@congty.com"
                                disabled={busy}
                                className="h-9 min-w-0 flex-1 rounded-lg border border-[#e0e3e5] px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] disabled:opacity-50"
                            />
                            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-[#5e3f3a]">
                                <input
                                    type="checkbox"
                                    checked={newIsPrimary}
                                    onChange={(e) => setNewIsPrimary(e.target.checked)}
                                    disabled={busy}
                                    className="accent-[#e3000f]"
                                />
                                Đặt làm chính
                            </label>
                            <button
                                type="button"
                                onClick={() => void handleAdd()}
                                disabled={busy || newEmail.trim() === ""}
                                className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Thêm
                            </button>
                        </div>
                    </section>

                    <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Đề xuất</h4>
                            <button
                                type="button"
                                onClick={() => void handleLoadSuggestions()}
                                disabled={busy}
                                title="Tìm email của tài khoản này trên AD (mail và alias)"
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                {busyAction === "suggestions" ? "Đang tìm..." : "Đề xuất đồng bộ"}
                            </button>
                        </div>
                        {suggestions !== null &&
                            (suggestions.length === 0 ? (
                                <p className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                                    Không tìm thấy email nào cho tài khoản này.
                                </p>
                            ) : (
                                <ul className="divide-y divide-[#e0e3e5] rounded-lg border border-[#e0e3e5]">
                                    {suggestions.map((item) => (
                                        <li key={item.email} className="flex items-center gap-2 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="truncate text-sm text-[#191c1e]">{item.email}</span>
                                                    <span className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-semibold text-[#5e3f3a]">
                                                        {USER_EMAIL_SOURCE_LABELS[item.source] ?? item.source}
                                                    </span>
                                                </div>
                                                {item.note && <p className="truncate text-xs text-[#8a8f94]">{item.note}</p>}
                                            </div>
                                            {item.alreadyAdded ? (
                                                <span className="shrink-0 text-xs text-[#8a8f94]">Đã có</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleAddSuggestion(item)}
                                                    disabled={busy}
                                                    className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-[#e0e3e5] px-2 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Thêm
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ))}
                    </section>

                    <section>
                        <h4
                            className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]"
                            title="Mỗi module gửi mail về email được chọn; để mặc định thì gửi về email chính."
                        >
                            Email nhận theo module
                        </h4>
                        <div className="divide-y divide-[#e0e3e5] rounded-lg border border-[#e0e3e5]">
                            {modules.map((m) => (
                                <div key={m.moduleCode} className="flex items-center gap-3 px-3 py-2">
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                        <span className="truncate text-sm text-[#191c1e]">{m.moduleName}</span>
                                        {!m.isApplied && (
                                            <span
                                                title="Module này chưa đọc cấu hình email ở đây — lưu trước, chưa có tác dụng."
                                                className="shrink-0 rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]"
                                            >
                                                Chưa áp dụng
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-60 shrink-0">
                                        <StyledSelect
                                            options={moduleOptions}
                                            value={moduleDraft[m.moduleCode] ?? PRIMARY_OPTION}
                                            onChange={(value) => setModuleDraft((prev) => ({ ...prev, [m.moduleCode]: value }))}
                                            disabled={busy || emails.length === 0}
                                            ariaLabel={`Email nhận cho ${m.moduleName}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleSaveModules()}
                                disabled={busy || !isModuleDirty}
                                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {busyAction === "modules" ? "Đang lưu..." : "Lưu"}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
