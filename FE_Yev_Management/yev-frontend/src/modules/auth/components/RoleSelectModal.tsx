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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Chọn vai trò</h3>
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-slate-200 px-6 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm vai trò..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-96 overflow-y-auto px-6 py-4 space-y-2">
                    {filteredRoles.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">
                            {roles.length === 0 ? "Không có vai trò nào" : "Không tìm thấy vai trò phù hợp"}
                        </div>
                    ) : (
                        filteredRoles.map((role) => (
                            <label
                                key={role.id}
                                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer transition hover:bg-slate-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedRoleIds.includes(role.id)}
                                    onChange={(e) => onRoleChange(role.id, e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800">{role.roleName}</p>
                                    {role.description && (
                                        <p className="text-xs text-slate-500">{role.description}</p>
                                    )}
                                </div>
                            </label>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
