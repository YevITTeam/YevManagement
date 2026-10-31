"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormPrintView from "@/modules/attendance/components/ot-form/OtFormPrintView";

// Inside (ot-manager) for the sidebar on screen; Sidebar/Header are print:hidden. Uses ?id= instead of [id]
// because static export would need every id in generateStaticParams().
function OtPrintContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <OtFormPrintView id={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <OtPrintContent />
        </Suspense>
    );
}
