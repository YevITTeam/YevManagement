"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { UserApprovalScopeApi } from "@/modules/attendance/api/user-approval-scope.api";
import type { UserApprovalScopeDto } from "@/modules/attendance/types/user-approval-scope.dto";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import {
    APPROVAL_LEVEL_ROLE_NAME,
    APPROVAL_LEVEL_SCOPE_TYPE,
    approvalLevelLabels,
    scopeTypeLabels,
} from "@/modules/attendance/types/enums";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;
const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

interface CreateFormState {
    userName: string;
    scopeType: number; // 0=Group, 1=Department
    scopeId: number;
    approvalLevel: number; // 0=Submitter (quyền tạo đơn), 1=DepartmentManager, 2=WorkshopManager
}

const emptyForm: CreateFormState = { userName: "", scopeType: 1, scopeId: 0, approvalLevel: 1 };

// docs/attendance-api-fe.md §5 — Admin gán phạm vi duyệt cho Trưởng phòng/Trưởng xưởng. Không có PUT: sửa = xoá + tạo lại.
export default function UserApprovalScopeManager() {
    const [scopes, setScopes] = useState<UserApprovalScopeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [usersWithRoles, setUsersWithRoles] = useState<UserDto[]>([]);

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<CreateFormState>(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    // Gợi ý Group tự động khi Admin gõ/chọn 1 tài khoản (docs §1.3.F/§3.5) — best-effort, 404 là bình
    // thường với Trưởng phòng/Trưởng xưởng/TGĐ/Trưởng Bộ phận (không nhất thiết có hồ sơ Employee).
    const [suggestedGroup, setSuggestedGroup] = useState<EmployeeDto | null>(null);

    const [deletingScope, setDeletingScope] = useState<UserApprovalScopeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [scopeSearch, setScopeSearch] = useState("");
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);

    const { isLoading, error, refetch: fetchScopes } = useFetchEffect(
        () => UserApprovalScopeApi.getScopePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setScopes(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách phân quyền duyệt.",
        (message) => toast.error(message)
    );

    useEffect(() => {
        GroupApi.getAllGroups().then(setGroups).catch((err) => console.error(err));
        DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
        // Chỉ để tra Role trước khi cho chọn Cấp duyệt "Người đề nghị" — không chặn màn nếu lỗi/thiếu quyền.
        AuthApi.getAllUsersWithRoles().then(setUsersWithRoles).catch((err) => console.error(err));
    }, []);

    // Xoá gợi ý cũ ngay khi tài khoản gõ đổi — so sánh snapshot trong thân render (không setState đồng
    // bộ trong effect, theo quy ước react-hooks/set-state-in-effect ở CLAUDE.md).
    const [suggestionKey, setSuggestionKey] = useState(form.userName);
    if (suggestionKey !== form.userName) {
        setSuggestionKey(form.userName);
        setSuggestedGroup(null);
    }

    // Debounce 400ms trước khi tra GET /Employee/by-username/{userName} — tránh gọi API mỗi lần gõ phím.
    useEffect(() => {
        const userName = form.userName.trim();
        if (!formOpen || !userName) return;
        const timer = setTimeout(() => {
            EmployeeApi.getEmployeeByUsername(userName)
                .then(setSuggestedGroup)
                .catch(() => setSuggestedGroup(null)); // 404 bình thường — không phải lỗi (docs §3.5).
        }, 400);
        return () => clearTimeout(timer);
    }, [formOpen, form.userName]);

    // Docs §5: chỉ chặn được khi tìm thấy đúng tài khoản (khớp userName tuyệt đối) và xác nhận thiếu Role —
    // không tìm thấy (vd đang gõ dở, sai hoa/thường theo AD) thì để BE tự quyết định, tránh chặn nhầm.
    // Mở rộng cho cả 4 cấp (trước 2026-07-17 chỉ check Submitter) — xem docs §5 "vá lỗ hổng".
    const matchedUser = usersWithRoles.find(
        (u) => u.userName.trim().toLowerCase() === form.userName.trim().toLowerCase()
    );
    const requiredRoleName = APPROVAL_LEVEL_ROLE_NAME[form.approvalLevel];
    const requiredRoleMissing =
        matchedUser !== undefined && requiredRoleName !== undefined && !matchedUser.roles.includes(requiredRoleName);

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setForm(emptyForm);
        setScopeSearch("");
        setShowUserSuggestions(false);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        // approvalLevel=0 (Submitter) là giá trị hợp lệ — không dùng truthy check kẻo bị coi là falsy.
        if (!form.userName.trim() || !form.scopeId) return;
        if (requiredRoleMissing) {
            toast.error(`Tài khoản chưa giữ Role "${requiredRoleName}" — gán Role qua Quản lý người dùng trước khi thêm phân quyền này.`);
            return;
        }
        setIsSaving(true);
        try {
            await UserApprovalScopeApi.createScope({
                userName: form.userName.trim(),
                scopeType: form.scopeType,
                scopeId: form.scopeId,
                approvalLevel: form.approvalLevel,
            });
            toast.success("Tạo phân quyền duyệt thành công");
            setFormOpen(false);
            await fetchScopes();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Tạo phân quyền duyệt thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingScope) return;
        setIsDeleting(true);
        try {
            await UserApprovalScopeApi.deleteScope(deletingScope.id);
            toast.success("Xoá phân quyền duyệt thành công");
            setDeletingScope(null);
            await fetchScopes();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá phân quyền duyệt thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    const scopeOptions = form.scopeType === 0 ? groups.map((g) => ({ id: g.id, label: g.groupNameVn })) : departments.map((d) => ({ id: d.id, label: d.departmentNameVn }));
    const filteredScopeOptions = scopeSearch.trim()
        ? scopeOptions.filter((option) => option.label.toLowerCase().includes(scopeSearch.trim().toLowerCase()))
        : scopeOptions;

    const userNameFilter = form.userName.trim().toLowerCase();
    const filteredUserSuggestions = (
        userNameFilter
            ? usersWithRoles.filter(
                  (u) => u.userName.toLowerCase().includes(userNameFilter) || u.fullName.toLowerCase().includes(userNameFilter)
              )
            : usersWithRoles
    ).slice(0, 8);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Phân quyền duyệt tăng ca</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Khai báo Trưởng Nhóm được tạo đơn (Người đề nghị), Trưởng Bộ phận duyệt sau khi Trưởng nhóm ký,
                        và Trưởng phòng/Trưởng xưởng phụ trách duyệt cho từng Bộ phận/Phòng ban. Tổng Giám Đốc không cần
                        khai báo ở đây (chỉ cần gán Role).
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchScopes()}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        ↻ Làm mới
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        + Thêm phân quyền
                    </button>
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo tài khoản..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${scopes.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Tài khoản</th>
                                <th className="px-6 py-3">Phạm vi</th>
                                <th className="px-6 py-3">Tên phạm vi</th>
                                <th className="px-6 py-3">Cấp duyệt</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && scopes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Chưa có phân quyền duyệt nào.
                                    </td>
                                </tr>
                            )}
                            {scopes.map((scope) => (
                                <tr key={scope.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">
                                        {scope.userFullName ?? scope.userName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{scopeTypeLabels[scope.scopeType]}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{scope.scopeName}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{approvalLevelLabels[scope.approvalLevel]}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <button
                                            onClick={() => setDeletingScope(scope)}
                                            className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                            title="Xoá"
                                        >
                                            Xoá
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        Trang trước
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        Trang {pageIndex} / {totalPages}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            </section>

            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && closeForm()} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">Thêm phân quyền duyệt</h3>
                            <button
                                type="button"
                                onClick={() => !isSaving && closeForm()}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <label className="relative block">
                                <span className={fieldLabelClassName}>Tài khoản (userName)</span>
                                <input
                                    value={form.userName}
                                    onChange={(event) => setForm((current) => ({ ...current, userName: event.target.value }))}
                                    onFocus={() => setShowUserSuggestions(true)}
                                    onBlur={() => setShowUserSuggestions(false)}
                                    placeholder="VD: YEV\\n.truong.b"
                                    disabled={isSaving}
                                    autoFocus
                                    required
                                    autoComplete="off"
                                    className={fieldClassName}
                                />
                                {showUserSuggestions && filteredUserSuggestions.length > 0 && (
                                    <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#e0e3e5] bg-white shadow-lg">
                                        {filteredUserSuggestions.map((u) => (
                                            <li key={u.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        setForm((current) => ({ ...current, userName: u.userName }));
                                                        setShowUserSuggestions(false);
                                                    }}
                                                    className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-[#f8fafc]"
                                                >
                                                    <div className="font-semibold text-[#191c1e]">{u.fullName || u.userName}</div>
                                                    <div className="text-xs text-[#5e3f3a]">{u.userName}</div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </label>

                            {suggestedGroup && (form.approvalLevel === 0 || form.approvalLevel === 4) && (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                                    <span>
                                        Gợi ý: tài khoản này thuộc Bộ phận <strong>{suggestedGroup.groupNameVn}</strong>.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setForm((current) => ({ ...current, scopeType: 0, scopeId: suggestedGroup.groupId }))
                                        }
                                        disabled={isSaving}
                                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-2 py-1 font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                    >
                                        Dùng gợi ý
                                    </button>
                                </div>
                            )}

                            <label className="block">
                                <span className={fieldLabelClassName}>Cấp duyệt</span>
                                <select
                                    value={form.approvalLevel}
                                    onChange={(event) => {
                                        const level = Number(event.target.value);
                                        setForm((current) => ({
                                            ...current,
                                            approvalLevel: level,
                                            scopeType: APPROVAL_LEVEL_SCOPE_TYPE[level] ?? current.scopeType,
                                            scopeId: 0,
                                        }));
                                        setScopeSearch("");
                                    }}
                                    disabled={isSaving}
                                    className={fieldClassName}
                                >
                                    <option value={0}>Người đề nghị</option>
                                    <option value={4}>{approvalLevelLabels[4]}</option>
                                    <option value={1}>{approvalLevelLabels[1]}</option>
                                    <option value={2}>{approvalLevelLabels[2]}</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className={fieldLabelClassName}>Phạm vi (tự động theo Cấp duyệt)</span>
                                <select value={form.scopeType} disabled className={fieldClassName}>
                                    <option value={0}>Bộ phận</option>
                                    <option value={1}>Phòng ban</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className={fieldLabelClassName}>{form.scopeType === 0 ? "Bộ phận" : "Phòng ban"}</span>
                                <input
                                    value={scopeSearch}
                                    onChange={(event) => setScopeSearch(event.target.value)}
                                    placeholder={`Tìm ${form.scopeType === 0 ? "bộ phận" : "phòng ban"}...`}
                                    disabled={isSaving}
                                    className={`${fieldClassName} mb-2`}
                                />
                                <select
                                    value={form.scopeId || ""}
                                    onChange={(event) => setForm((current) => ({ ...current, scopeId: Number(event.target.value) }))}
                                    disabled={isSaving}
                                    required
                                    size={Math.min(6, Math.max(3, filteredScopeOptions.length + 1))}
                                    className={`${fieldClassName} h-auto py-1`}
                                >
                                    <option value="" disabled>
                                        Chọn {form.scopeType === 0 ? "bộ phận" : "phòng ban"}...
                                    </option>
                                    {filteredScopeOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                    {filteredScopeOptions.length === 0 && (
                                        <option value="" disabled>
                                            Không tìm thấy kết quả phù hợp
                                        </option>
                                    )}
                                </select>
                            </label>

                            {form.userName.trim() && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        requiredRoleMissing
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : matchedUser
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {requiredRoleMissing
                                        ? `Tài khoản "${form.userName.trim()}" chưa giữ Role "${requiredRoleName}" — BE sẽ từ chối. Gán Role này qua Quản lý người dùng trước.`
                                        : matchedUser
                                        ? `Tài khoản đã giữ Role "${requiredRoleName}" ✓`
                                        : `Không tìm thấy tài khoản này trong danh sách người dùng — kiểm tra lại chính tả trước khi gửi.`}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={isSaving}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || requiredRoleMissing}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSaving ? "Đang lưu..." : "Tạo mới"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deletingScope !== null}
                title="Xoá phân quyền duyệt"
                message={
                    <>
                        Bạn có chắc muốn xoá phân quyền của <strong>{deletingScope?.userName}</strong> với{" "}
                        <strong>{deletingScope?.scopeName}</strong> không?
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingScope(null);
                }}
            />
        </div>
    );
}
