"use client";

import { Suspense } from "react";
import LoginForm from "@/modules/auth/components/LoginForm";

// LoginForm dùng useSearchParams (?redirect=) — "output: export" (static export) yêu cầu bọc Suspense,
// xem cách làm y hệt ở app/[locale]/(pc-manager)/pc/devices/page.tsx.
export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
