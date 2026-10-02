"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { getAuthToken, clearAuthToken, setOnUnauthorized } from "@/lib/client";
import type { LoginRequestDto, UserDto } from "@/modules/auth/types/auth.dto";

interface AuthContextValue {
    user: UserDto | null;
    isLoading: boolean;
    // Lấy lại JWT + user/permissions mới nhất — dùng khi Admin vừa đổi permission của Role mình.
    // Đi qua `/Auth/me` (Bearer) nên KHÔNG kéo theo handshake Negotiate: BE dựng lại Role/Permission từ DB
    // ở mọi request nên dữ liệu trả về vẫn là bản mới nhất (docs/identity-api-fe.md §2b).
    refreshUser: () => Promise<void>;
    // Đăng nhập bằng form username/password ở trang /login (docs/identity-api-fe.md §2c) — set user
    // trực tiếp từ response, không cần gọi thêm `/Auth/me`. Ném lỗi lên cho form tự bắt + hiện toast.
    loginWithPassword: (credentials: LoginRequestDto) => Promise<void>;
    // Đăng nhập bằng tài khoản Windows hiện tại (Negotiate) — nút phụ trên trang /login cho máy đã có SSO.
    loginWithWindows: () => Promise<void>;
    // Xoá JWT + reset user về null. KHÔNG tự điều hướng — nơi gọi (Header/route guard) tự quyết định
    // chuyển sang /login.
    logout: () => void;
}

// Chu kỳ tự gia hạn JWT khi tab vẫn đang mở. Token sống 120 phút (`JwtSettings:ExpiryMinutes` ở BE);
// nếu để hết hạn giữa chừng, request nghiệp vụ kế tiếp sẽ 401 → `client.ts` buộc phải đăng nhập lại bằng
// Negotiate, và trên máy chưa bật SSO cho origin của BE thì đó là một popup hỏi mật khẩu domain ngay
// giữa giờ làm. `/Auth/me` gia hạn được âm thầm bằng chính token cũ nên chỉ cần gọi định kỳ là đủ.
const TOKEN_RENEW_INTERVAL_MS = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Nơi lưu profile user (fullName, roles, permissions...) duy nhất của FE — CHỈ trong bộ nhớ JS của tab
// hiện tại (React state), KHÔNG persist xuống localStorage/sessionStorage. Lý do: đây là dữ liệu nhạy cảm
// hơn token thuần (lộ ra roles/permissions cụ thể của user), nên không nên nằm ở nơi mọi script/extension
// trên trang có thể đọc được và tồn tại vô thời hạn qua nhiều phiên. Reload trang (F5) sẽ mất state này
// và tự nạp lại qua `/Auth/me` (âm thầm, Bearer) NẾU còn token hợp lệ; hết token thì set `user = null`
// và guard (`AuthGuard`) tự chuyển hướng sang `/login` — không tự bật Negotiate nữa (xem
// docs/identity-api-fe.md §2c, §5.4).
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        setIsLoading(true);
        try {
            const current = await AuthApi.me();
            setUser(current);
        } catch {
            clearAuthToken();
            setUser(null);
            throw new Error("Không thể làm mới phiên đăng nhập. Vui lòng thử lại.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => {
            clearAuthToken();
            setUser(null);
        };
        setOnUnauthorized(handleUnauthorized);
        window.addEventListener("auth:unauthorized", handleUnauthorized);
        return () => {
            setOnUnauthorized(null);
            window.removeEventListener("auth:unauthorized", handleUnauthorized);
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;

        // CHỈ tự nạp phiên khi đã có JWT (qua `/Auth/me`, âm thầm) — KHÔNG tự gọi windows-login khi
        // chưa có token. Trước đây gọi `AuthApi.getCurrentUser()` vô điều kiện ở đây khiến MỌI trang
        // chưa đăng nhập tự bật 1 handshake Negotiate mới (popup "Windows Security" của trình duyệt,
        // lặp lại ở mỗi lần mount/điều hướng khi chưa có token) — nguồn gốc lỗi "bị hỏi đăng nhập
        // nhiều lần". Giờ trang /login là nơi DUY NHẤT chủ động gọi loginWithWindows()/loginWithPassword().
        // Nhánh "chưa có token" cũng phải đi qua Promise.resolve() rồi setState trong `.then()` — không
        // được setState thẳng trong thân effect — vì rule `react-hooks/set-state-in-effect` của React
        // Compiler chỉ cho phép setState trong `.then()/.catch()/.finally()` (AGENTS.md §4.5).
        const load = getAuthToken() ? AuthApi.me() : Promise.resolve(null);

        load
            .then((current) => {
                if (!isCancelled) setUser(current);
            })
            .catch(() => {
                if (!isCancelled) {
                    clearAuthToken();
                    setUser(null);
                }
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });
        return () => {
            isCancelled = true;
        };
    }, []);

    // Gia hạn token định kỳ (xem TOKEN_RENEW_INTERVAL_MS). Không đụng tới state — hồ sơ user hiển thị
    // trên Header không đổi, chỉ có JWT trong localStorage được thay bằng bản còn hạn; gia hạn hỏng thì
    // im lặng bỏ qua, request nghiệp vụ kế tiếp gặp 401 sẽ tự xử lý như trước.
    useEffect(() => {
        const timer = setInterval(() => {
            if (!getAuthToken()) return;
            AuthApi.me().catch(() => undefined);
        }, TOKEN_RENEW_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    const loginWithPassword = useCallback(async (credentials: LoginRequestDto) => {
        const current = await AuthApi.login(credentials);
        setUser(current);
    }, []);

    const loginWithWindows = useCallback(async () => {
        const current = await AuthApi.windowsLogin();
        setUser(current);
    }, []);

    const logout = useCallback(() => {
        clearAuthToken();
        setUser(null);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ user, isLoading, refreshUser, loginWithPassword, loginWithWindows, logout }),
        [user, isLoading, refreshUser, loginWithPassword, loginWithWindows, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth() phải được gọi bên trong <AuthProvider>.");
    }
    return context;
}
