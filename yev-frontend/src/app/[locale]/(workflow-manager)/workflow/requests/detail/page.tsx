"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkflowRequestDetail from "@/modules/workflow/components/requests/WorkflowRequestDetail";

// ?id= / ?formDefinitionId= instead of [id] for static export. ?formDefinitionId= is a not-yet-saved request,
// so picking the wrong form type doesn't create junk WorkflowRequests.
function WorkflowRequestDetailContent() {
    const searchParams = useSearchParams();
    const idParam = searchParams.get("id");
    const formDefinitionIdParam = searchParams.get("formDefinitionId");
    const id = idParam ? Number(idParam) : null;
    const formDefinitionId = formDefinitionIdParam ? Number(formDefinitionIdParam) : null;
    return <WorkflowRequestDetail id={id} formDefinitionId={formDefinitionId} />;
}

export default function WorkflowRequestDetailPage() {
    return (
        <Suspense>
            <WorkflowRequestDetailContent />
        </Suspense>
    );
}
