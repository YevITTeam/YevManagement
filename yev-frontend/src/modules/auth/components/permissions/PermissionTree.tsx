"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import type { PermissionDto, PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";

interface PermissionTreeProps {
    moduleGroups: PermissionModuleGroupDto[];
    isChecked: (permissionId: number) => boolean;
    onToggle: (permissions: PermissionDto[], checked: boolean) => void;
    disabled?: boolean;
    /** Small badge next to each permission (e.g. granted/revoked). */
    renderBadge?: (permission: PermissionDto) => ReactNode;
}

const checkboxClassName = "h-4 w-4 shrink-0 cursor-pointer accent-[#e3000f] disabled:cursor-not-allowed";

function CountBar({ granted, total }: { granted: number; total: number }) {
    return (
        <span className="flex shrink-0 items-center gap-2">
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#e0e3e5]">
                <span
                    className="block h-full rounded-full bg-[#e3000f] transition-all"
                    style={{ width: total === 0 ? "0%" : `${(granted / total) * 100}%` }}
                />
            </span>
            <span className="min-w-10 text-right text-xs font-medium tabular-nums text-[#5e3f3a]">
                {granted}/{total}
            </span>
        </span>
    );
}

// Shared by the role and per-user permission screens; searching auto-expands matching branches.
export default function PermissionTree({ moduleGroups, isChecked, onToggle, disabled = false, renderBadge }: PermissionTreeProps) {
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    const term = searchTerm.trim().toLowerCase();
    const isSearching = term !== "";

    const toggleInSet = (setter: typeof setExpandedModules, key: string) =>
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const expandAll = () => {
        setExpandedModules(new Set(moduleGroups.map((m) => m.module)));
        setExpandedEntities(new Set(moduleGroups.flatMap((m) => m.entities.map((e) => `${m.module}::${e.entity}`))));
    };
    const collapseAll = () => {
        setExpandedModules(new Set());
        setExpandedEntities(new Set());
    };

    const matches = (permission: PermissionDto, moduleName: string, entityName: string) =>
        `${permission.description} ${permission.code} ${moduleName} ${entityName}`.toLowerCase().includes(term);

    const visibleGroups = moduleGroups
        .map((moduleGroup) => ({
            ...moduleGroup,
            entities: moduleGroup.entities
                .map((entityGroup) => ({
                    ...entityGroup,
                    permissions: isSearching
                        ? entityGroup.permissions.filter((p) => matches(p, moduleGroup.module, entityGroup.entity))
                        : entityGroup.permissions,
                }))
                .filter((entityGroup) => entityGroup.permissions.length > 0),
        }))
        .filter((moduleGroup) => moduleGroup.entities.length > 0);

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e3e5] px-4 py-2.5">
                <div className="relative min-w-48 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94]" />
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Tìm quyền..."
                        className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    {isSearching && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            aria-label="Xoá tìm kiếm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[#8a8f94] transition hover:text-[#191c1e]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={expandAll}
                    className="h-9 cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                >
                    Mở hết
                </button>
                <button
                    type="button"
                    onClick={collapseAll}
                    className="h-9 cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                >
                    Thu gọn
                </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto bg-[#f8fafc] p-3">
                {visibleGroups.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không tìm thấy quyền nào.</div>
                )}

                {visibleGroups.map((moduleGroup) => {
                    const modulePermissions = moduleGroup.entities.flatMap((e) => e.permissions);
                    const moduleGranted = modulePermissions.filter((p) => isChecked(p.id)).length;
                    const moduleAll = moduleGranted === modulePermissions.length;
                    const moduleSome = moduleGranted > 0 && !moduleAll;
                    const isModuleOpen = isSearching || expandedModules.has(moduleGroup.module);

                    return (
                        <section key={moduleGroup.module} className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <button
                                    type="button"
                                    onClick={() => toggleInSet(setExpandedModules, moduleGroup.module)}
                                    aria-label={isModuleOpen ? "Thu gọn" : "Mở rộng"}
                                    className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                >
                                    {isModuleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm font-semibold text-[#191c1e]">
                                    <input
                                        type="checkbox"
                                        checked={moduleAll}
                                        disabled={disabled}
                                        ref={(el) => {
                                            if (el) el.indeterminate = moduleSome;
                                        }}
                                        onChange={(event) => onToggle(modulePermissions, event.target.checked)}
                                        className={checkboxClassName}
                                    />
                                    {moduleGroup.module}
                                </label>
                                <CountBar granted={moduleGranted} total={modulePermissions.length} />
                            </div>

                            {isModuleOpen && (
                                <div className="divide-y divide-[#f1f5f9] border-t border-[#f1f5f9]">
                                    {moduleGroup.entities.map((entityGroup) => {
                                        const entityGranted = entityGroup.permissions.filter((p) => isChecked(p.id)).length;
                                        const entityAll = entityGranted === entityGroup.permissions.length;
                                        const entitySome = entityGranted > 0 && !entityAll;
                                        const entityKey = `${moduleGroup.module}::${entityGroup.entity}`;
                                        const isEntityOpen = isSearching || expandedEntities.has(entityKey);

                                        return (
                                            <div key={entityGroup.entity} className="py-1.5">
                                                <div className="flex items-center gap-3 px-3 pl-9">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleInSet(setExpandedEntities, entityKey)}
                                                        aria-label={isEntityOpen ? "Thu gọn" : "Mở rộng"}
                                                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    >
                                                        {isEntityOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                    </button>
                                                    <label className="flex flex-1 cursor-pointer items-center gap-2.5 py-1 text-sm font-semibold text-[#191c1e]">
                                                        <input
                                                            type="checkbox"
                                                            checked={entityAll}
                                                            disabled={disabled}
                                                            ref={(el) => {
                                                                if (el) el.indeterminate = entitySome;
                                                            }}
                                                            onChange={(event) => onToggle(entityGroup.permissions, event.target.checked)}
                                                            className={checkboxClassName}
                                                        />
                                                        {entityGroup.entity}
                                                    </label>
                                                    <span className="rounded-full bg-[#f2f4f6] px-2 py-0.5 text-xs font-medium tabular-nums text-[#5e3f3a]">
                                                        {entityGranted}/{entityGroup.permissions.length}
                                                    </span>
                                                </div>

                                                {isEntityOpen && (
                                                    <div className="mt-0.5 space-y-0.5 pl-[4.25rem] pr-3">
                                                        {entityGroup.permissions.map((permission) => {
                                                            const checked = isChecked(permission.id);
                                                            return (
                                                                <label
                                                                    key={permission.id}
                                                                    title={permission.code}
                                                                    className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition hover:bg-[#f8fafc] ${
                                                                        checked ? "text-[#191c1e]" : "text-[#5e3f3a]"
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        disabled={disabled}
                                                                        onChange={(event) => onToggle([permission], event.target.checked)}
                                                                        className={checkboxClassName}
                                                                    />
                                                                    <span className="flex-1">{permission.description}</span>
                                                                    {renderBadge?.(permission)}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
