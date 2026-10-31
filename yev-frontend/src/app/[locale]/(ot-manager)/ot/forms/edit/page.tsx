"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import CreateOtFormPage from "@/modules/attendance/components/ot-form/CreateOtFormPage";

// ?id= instead of [id]/edit: static export would need every id in generateStaticParams().
function EditOtFormContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <CreateOtFormPage otFormId={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <EditOtFormContent />
        </Suspense>
    );
}
