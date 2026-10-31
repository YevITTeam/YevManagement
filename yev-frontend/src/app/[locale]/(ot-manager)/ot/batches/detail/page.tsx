"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormBatchDetail from "@/modules/attendance/components/ot-form-batch/OtFormBatchDetail";

// ?id= instead of [id]: static export would need every id in generateStaticParams().
function OtFormBatchDetailContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <OtFormBatchDetail variant="app" id={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <OtFormBatchDetailContent />
        </Suspense>
    );
}
