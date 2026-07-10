"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { clearAuthToken } from "@/lib/client";
import type { UserDto } from "@/modules/auth/types/auth.dto";

interface AuthContextValue {
    user: UserDto | null;
    isLoading: boolean;
    // Xoá token cũ rồi gọi lại windows-login để lấy JWT + user/permissions mới nhất — dùng khi Admin vừa
    // đổi permission của Role mình (docs/identity-api-fe.md §2.2: gọi lại windows-login là cách duy nhất
    // để lấy `user.permissions` mới nhất hiển thị lên UI, dù BE vẫn luôn tự enforce lại permission mới nhất
    // ở tầng API bất kể FE có refresh hay không).
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Nơi lưu profile user (fullName, roles, permissions...) duy nhất của FE — CHỈ trong bộ nhớ JS của tab
// hiện tại (React state), KHÔNG persist xuống localStorage/sessionStorage. Lý do: đây là dữ liệu nhạy cảm
// hơn token thuần (lộ ra roles/permissions cụ thể của user), nên không nên nằm ở nơi mọi script/extension
// trên trang có thể đọc được và tồn tại vô thời hạn qua nhiều phiên. Reload trang (F5) sẽ mất state này
// và tự gọi lại windows-login — chấp nhận được vì đây là Negotiate/Kerberos âm thầm, không phải popup nhập
// mật khẩu (xem docs/identity-api-fe.md §2.2).
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        setIsLoading(true);
        clearAuthToken();
        try {
            const current = await AuthApi.getCurrentUser();
            setUser(current);
        } catch {
            setUser(null);
            throw new Error("Không thể đăng nhập lại. Vui lòng thử lại.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let isCancelled = false;
        (async () => {
            try {
                const current = await AuthApi.getCurrentUser();
                if (!isCancelled) setUser(current);
            } catch {
                if (!isCancelled) setUser(null);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        })();
        return () => {
            isCancelled = true;
        };
    }, []);

    const value = useMemo<AuthContextValue>(() => ({ user, isLoading, refreshUser }), [user, isLoading, refreshUser]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth() phải được gọi bên trong <AuthProvider>.");
    }
    return context;
}
