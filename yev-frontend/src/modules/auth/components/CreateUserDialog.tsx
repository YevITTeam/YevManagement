"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react";

import { AuthApi } from "@/modules/auth/api/auth.api";
import type { RoleDto } from "@/modules/auth/types/auth.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { RequiredMark } from "@/components/ui/RequiredMark";

interface Props {
    isOpen: boolean;
    roles: RoleDto[];
    onClose: () => void;
    onCreated: () => void;
}

const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

export default function CreateUserDialog({ isOpen, roles, onClose, onCreated }: Props) {
    const [userName, setUserName] = useState("");
    const [deviceName, setDeviceName] = useState("");
    const [fullName, setFullName] = useState("");
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const resetAndClose = () => {
        if (isSaving) return;
        setUserName("");
        setDeviceName("");
        setFullName("");
        setRoleIds([]);
        onClose();
    };

    const toggleRole = (roleId: number, checked: boolean) => {
        setRoleIds((current) => (checked ? [...current, roleId] : current.filter((id) => id !== roleId)));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!userName.trim()) {
            toast.error("Vui lòng nhập Tên đăng nhập Windows.");
            return;
        }
        setIsSaving(true);
        try {
            await AuthApi.createUser({
                userName: userName.trim(),
                deviceName: deviceName.trim() || undefined,
                fullName: fullName.trim() || undefined,
                roleIds: roleIds.length > 0 ? roleIds : undefined,
            });
            toast.success("Tạo user thành công.");
            resetAndClose();
            onCreated();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Tạo user thất bại."));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/60 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">Tạo user thủ công</h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chuẩn bị trước tài khoản cho 1 nhân viên/máy cụ thể, trước khi họ đăng nhập Windows lần đầu.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={resetAndClose}
                        disabled={isSaving}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Tên đăng nhập Windows<RequiredMark />
                        </span>
                        <input
                            value={userName}
                            onChange={(event) => setUserName(event.target.value)}
                            disabled={isSaving}
                            required
                            placeholder={"YEV\\n.v.a"}
                            className={inputClassName}
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Tên máy (Device Name)
                        </span>
                        <input
                            value={deviceName}
                            onChange={(event) => setDeviceName(event.target.value)}
                            disabled={isSaving}
                            placeholder="YDC2341-1PCDIT.yev.vn (tuỳ chọn)"
                            className={inputClassName}
                        />
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chỉ để tham khảo/hiển thị, không ảnh hưởng việc khớp tài khoản lúc đăng nhập thật
                            (server chỉ khớp theo Tên đăng nhập Windows).
                        </p>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Họ tên
                        </span>
                        <input
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            disabled={isSaving}
                            placeholder="Nguyễn Văn A"
                            className={inputClassName}
                        />
                    </label>

                    <div>
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Vai trò (để trống = mặc định &quot;Basic&quot; khi đăng nhập)
                        </span>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-[#e0e3e5] p-3">
                            {roles.length === 0 ? (
                                <p className="text-sm text-[#5e3f3a]">Không có vai trò nào.</p>
                            ) : (
                                roles.map((role) => (
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
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-[#e0e3e5] pt-4">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Đang tạo..." : "Tạo user"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
