"use client";

import { Suspense } from "react";
import LoginForm from "@/modules/auth/components/LoginForm";

// LoginForm uses useSearchParams, which static export requires to be wrapped in Suspense.
export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
