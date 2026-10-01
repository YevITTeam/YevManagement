"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkflowRequestDetail from "@/modules/workflow/components/requests/WorkflowRequestDetail";

// Query string (?id= hoặc ?formDefinitionId=) thay vì route động [id] — static export (AGENTS.md
// §4.1), mirror form-definitions/detail/page.tsx. ?formDefinitionId= = đơn CHƯA tồn tại trong DB
// (chọn loại đơn xong, chưa lưu nháp lần nào) — tránh tạo rác WorkflowRequests chỉ vì bấm nhầm loại
// đơn (workflow-module.md §10, yêu cầu người dùng 2026-08-26).
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
