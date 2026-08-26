"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FormDefinitionDetail from "@/modules/workflow/components/form-definitions/FormDefinitionDetail";

// Dùng query string (?id=) thay vì route động [id]: "output: export" (static export) yêu cầu mọi
// route động phải khai báo trước toàn bộ id qua generateStaticParams(), không khả thi vì id form
// phát sinh liên tục từ BE — mirror OtFormDetail (app/[locale]/(ot-manager)/ot/forms/page.tsx).
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
