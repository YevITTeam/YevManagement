"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { RoleDto } from "@/modules/auth/types/auth.dto";

interface Props {
    isOpen: boolean;
    roles: RoleDto[];
    selectedRoleIds: number[];
    onRoleChange: (roleId: number, isChecked: boolean) => void;
    onClose: () => void;
}

export default function RoleSelectModal({ isOpen, roles, selectedRoleIds, onRoleChange, onClose }: Props) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredRoles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return roles;
        return roles.filter((role) => {
            return (
                role.roleName.toLowerCase().includes(term) ||
                (role.description?.toLowerCase() ?? "").includes(term)
            );
        });
    }, [roles, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/60 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <h3 className="text-lg font-semibold text-[#191c1e]">Chọn vai trò</h3>
                    <button
                        onClick={onClose}
                        className="text-[#5e3f3a] transition hover:text-[#e3000f]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm vai trò..."
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-96 space-y-2 overflow-y-auto px-6 py-4">
                    {filteredRoles.length === 0 ? (
                        <div className="py-8 text-center text-sm text-[#5e3f3a]">
                            {roles.length === 0 ? "Không có vai trò nào" : "Không tìm thấy vai trò"}
                        </div>
                    ) : (
                        filteredRoles.map((role) => (
                            <label
                                key={role.id}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e0e3e5] bg-white p-3 transition hover:border-[#e3000f] hover:bg-[#fff4f2]"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedRoleIds.includes(role.id)}
                                    onChange={(e) => onRoleChange(role.id, e.target.checked)}
                                    className="mt-1 h-4 w-4 cursor-pointer accent-[#e3000f]"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-[#191c1e]">{role.roleName}</p>
                                    {role.description && (
                                        <p className="mt-0.5 text-xs text-[#5e3f3a]">{role.description}</p>
                                    )}
                                </div>
                            </label>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-[#e0e3e5] bg-[#f8fafc] px-6 py-3">
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}