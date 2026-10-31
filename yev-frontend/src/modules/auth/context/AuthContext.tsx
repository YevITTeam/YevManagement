"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { getAuthToken, clearAuthToken, setOnUnauthorized } from "@/lib/client";
import type { LoginRequestDto, UserDto } from "@/modules/auth/types/auth.dto";

interface AuthContextValue {
    user: UserDto | null;
    isLoading: boolean;
    // Goes through /Auth/me (Bearer) to avoid a Negotiate handshake; BE rebuilds permissions from DB per request.
    refreshUser: () => Promise<void>;
    // Sets the user from the response; throws so the form can show the toast.
    loginWithPassword: (credentials: LoginRequestDto) => Promise<void>;
    // Negotiate login with the current Windows account, for SSO-enabled machines.
    loginWithWindows: () => Promise<void>;
    // Does not navigate; callers (Header/guards) decide on redirecting to /login.
    logout: () => void;
}

// Token lives 120 min; silent renewal via /Auth/me avoids a mid-shift 401 that would pop a
// domain password prompt on machines without SSO for the BE origin.
const TOKEN_RENEW_INTERVAL_MS = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Profile is kept in memory only (never storage) since roles/permissions are more sensitive than the token;
// F5 restores it via /Auth/me while a token exists, otherwise AuthGuard sends the user to /login.
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

        // Restore only when a JWT exists: calling windows-login without one pops repeated Negotiate prompts.
        // The no-token branch still goes through .then() because react-hooks/set-state-in-effect forbids direct setState.
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

    // Only the JWT is swapped; failures are ignored since the next 401 is handled by client.ts.
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
