"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FormDefinitionDetail from "@/modules/workflow/components/form-definitions/FormDefinitionDetail";

// ?id= instead of [id]: static export would need every id in generateStaticParams().
function FormDefinitionDetailContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <FormDefinitionDetail id={id} />;
}

export default function WorkflowFormDefinitionDetailPage() {
    return (
        <Suspense>
            <FormDefinitionDetailContent />
        </Suspense>
    );
}
