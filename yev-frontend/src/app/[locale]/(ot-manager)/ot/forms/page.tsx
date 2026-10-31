"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormDetail from "@/modules/attendance/components/ot-form/OtFormDetail";

// ?id= instead of [id]: static export would need every id in generateStaticParams().
function OtFormDetailContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <OtFormDetail id={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <OtFormDetailContent />
        </Suspense>
    );
}
