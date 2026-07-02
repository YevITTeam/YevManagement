"use client";

import { useEffect, useState } from "react";
import { AdminApi } from "@/api/admin.api";
import { AuthApi } from "@/api/auth.api";
import { UserDto, RoleDto } from "@/types/auth.dto";
import { toast } from 'react-toastify';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function UserRoleModal({ isOpen, onClose }: Props) {
    const [users, setUsers] = useState<UserDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [currentUser, setCurrentUser] = useState<UserDto | null>(null);

    // Lưu trạng thái các quyền đang được tick của từng user: { [userId]: [roleId1, roleId2] }
    const [selectedRolesMap, setSelectedRolesMap] = useState<Record<number, number[]>>({});
    const [isLoading, setIsLoading] = useState(false);

    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

    // Load dữ liệu khi mở Modal
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setIsLoading(true);
        try {

            const [usersData, rolesData, meData] = await Promise.all([
                AdminApi.getUsers(),
                AdminApi.getRoles(),
                AuthApi.getMe(),
            ]);

            setUsers(usersData);
            setRoles(rolesData);
            setCurrentUser(meData);

            // Khởi tạo state checkbox dựa trên dữ liệu từ DB
            const initialRoleMap: Record<number, number[]> = {};
            usersData.forEach((user: UserDto) => {
                // Ánh xạ từ mảng string (tên quyền) sang mảng ID quyền
                const userRoleIds = rolesData
                    .filter((r: RoleDto) => user.roles.includes(r.roleName))
                    .map((r: RoleDto) => r.id);
                initialRoleMap[user.id] = userRoleIds;
            });
            setSelectedRolesMap(initialRoleMap);

        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
            toast.warn("Không thể tải dữ liệu. Vui lòng thử lại!");
        } finally {
            setIsLoading(false);
        }
    };

    // Xử lý khi click vào 1 checkbox
    const handleCheckboxChange = (userId: number, roleId: number, isChecked: boolean) => {
        setSelectedRolesMap((prev) => {
            const currentRoles = prev[userId] || [];
            if (isChecked) {
                return { ...prev, [userId]: [...currentRoles, roleId] };
            } else {
                return { ...prev, [userId]: currentRoles.filter((id) => id !== roleId) };
            }
        });
    };

    // Xử lý khi bấm nút "Cập nhật" trên 1 dòng
    const handleSave = async (userId: number) => {
        try {
            const roleIds = selectedRolesMap[userId] || [];
            await AdminApi.updateUserRoles({ userId, roleIds });
            toast.success("Cập nhật quyền thành công!");
            await fetchData();
        } catch (error) {
            toast.error("Cập nhật thất bại!");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center  bg-opacity-50 backdrop-blur">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">Quản lý Phân quyền Người dùng</h2>
                    <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-red-500 transition text-2xl leading-none">
                        &times;
                    </button>
                </div>

                {/* Nội dung bảng */}
                <div className="p-6 overflow-y-auto flex-grow">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10 text-gray-500">Đang tải dữ liệu...</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                                    <th className="p-3 border-b w-1/4">Tài khoản</th>
                                    <th className="p-3 border-b w-2/5">Họ tên</th>
                                    <th className="p-3 border-b w-1/5">Chọn Quyền</th>
                                    <th className="p-3 border-b text-center w-auto">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    // KIỂM TRA: Có phải là chính bản thân người đang thao tác không?
                                    const isSelf = currentUser?.userName === u.userName;
                                    const currentSelectedIds = selectedRolesMap[u.id] || [];

                                    return (
                                        <tr key={u.id} className={`border-b hover:bg-gray-50 ${isSelf ? "bg-red-50/30" : ""}`}>
                                            <td className="p-3 font-medium text-gray-800">
                                                {u.userName}
                                                {isSelf && <span className="ml-2 text-xs text-red-500 font-bold">(Bạn)</span>}
                                            </td>
                                            <td className="p-3 text-gray-600">{u.fullName}</td>

                                            {/* Cột hiển thị Checkbox cho phép chọn nhiều Role */}
                                            <td className="p-3 relative">
                                                <div className="relative">
                                                    {/* Nút bấm để mở/đóng dropdown */}
                                                    <button
                                                        onClick={() => setOpenDropdownId(openDropdownId === u.id ? null : u.id)}
                                                        disabled={isSelf}
                                                        className=" px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-left flex justify-between items-center hover:border-blue-500 transition"
                                                    >
                                                        <span className="truncate text-gray-700">
                                                            {currentSelectedIds.length > 0
                                                                ? `${currentSelectedIds.length} quyền đã chọn`
                                                                : "Chọn quyền..."}
                                                        </span>
                                                        <span className="text-xs">▼</span>
                                                    </button>

                                                    {/* Dropdown menu */}
                                                    {openDropdownId === u.id && (
                                                        <>
                                                            {/* Overlay để click ra ngoài là đóng */}
                                                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>

                                                            <div className="absolute z-20 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-2 max-h-60 overflow-y-auto">
                                                                {roles.map((r) => (
                                                                    <label
                                                                        key={r.id}
                                                                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={currentSelectedIds.includes(r.id)}
                                                                            onChange={(e) => handleCheckboxChange(u.id, r.id, e.target.checked)}
                                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                                        />
                                                                        <span className="text-sm text-gray-700">{r.roleName}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => handleSave(u.id)}
                                                    disabled={isSelf}
                                                    className={`cursor-pointer px-4 py-1.5 rounded-md text-sm font-semibold text-white shadow-sm transition 
                                                        ${isSelf
                                                            ? "bg-gray-300 cursor-not-allowed"
                                                            : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                                                        }`}
                                                >
                                                    Cập nhật
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}