"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, Rocket, Copy } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { FormCategoryApi } from "@/modules/workflow/api/form-category.api";
import type { FormDefinitionDto } from "@/modules/workflow/types/form-definition.dto";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import FormDefinitionForm, { type FormDefinitionFormValues } from "./FormDefinitionForm";
import CloneFormDefinitionDialog, { type CloneFormDefinitionValues } from "./CloneFormDefinitionDialog";
import FormFieldDesigner from "./field-designer/FormFieldDesigner";
import FormFieldConditionsPanel from "./conditions/FormFieldConditionsPanel";
import FormAccessesPanel from "./accesses/FormAccessesPanel";
import FormApprovalRoutesPanel from "./routes/FormApprovalRoutesPanel";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

interface FormDefinitionDetailProps {
    id: number;
}

type TabKey = "fields" | "conditions" | "accesses" | "routes";

export default function FormDefinitionDetail({ id }: FormDefinitionDetailProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.FormDesign.Manage");

    const [formDefinition, setFormDefinition] = useState<FormDefinitionDto | null>(null);
    const [formCategories, setFormCategories] = useState<FormCategoryDto[]>([]);
    const [activeTab, setActiveTab] = usePersistedTab<TabKey>(`workflow-form-definition-tab-${id}`, ["fields", "conditions", "accesses", "routes"], "fields");
    const [editFormOpen, setEditFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [isCloning, setIsCloning] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        async () => {
            const [detail, categories] = await Promise.all([FormDefinitionApi.getFormDefinitionById(id), FormCategoryApi.getAllFormCategories()]);
            return { detail, categories };
        },
        [id],
        (result) => {
            setFormDefinition(result.detail);
            setFormCategories(result.categories);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const handleUpdateBasicInfo = async (values: FormDefinitionFormValues) => {
        if (!formDefinition) return;
        setIsSaving(true);
        try {
            await FormDefinitionApi.updateFormDefinition(formDefinition.id, {
                code: values.code,
                nameVn: values.nameVn,
                nameJp: values.nameJp,
                formCategoryId: values.formCategoryId,
                description: values.description,
                allowAttachment: values.allowAttachment,
                requireAttachment: values.requireAttachment,
                codePrefix: values.codePrefix,
                routeNumericFieldKey: values.routeNumericFieldKey,
                routeClassFieldKey: values.routeClassFieldKey,
            });
            toast.success(t("updateSuccess"));
            setEditFormOpen(false);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!formDefinition) return;
        setIsPublishing(true);
        try {
            await FormDefinitionApi.publish(formDefinition.id);
            toast.success(t("publishSuccess"));
            setPublishConfirmOpen(false);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("publishError")));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleClone = async (values: CloneFormDefinitionValues) => {
        if (!formDefinition) return;
        setIsCloning(true);
        try {
            const result = await FormDefinitionApi.clone(formDefinition.id, values);
            toast.success(t("cloneSuccess"));
            setCloneDialogOpen(false);
            router.push({ pathname: "/workflow/form-definitions/detail", query: { id: String(result.id) } });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("cloneError")));
        } finally {
            setIsCloning(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-96" />
            </div>
        );
    }

    if (error || !formDefinition) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const tabs: { key: TabKey; label: string }[] = [
        { key: "fields", label: t("tabFields") },
        { key: "conditions", label: t("tabConditions") },
        { key: "accesses", label: t("tabAccesses") },
        { key: "routes", label: t("tabRoutes") },
    ];

    return (
        <div className="space-y-6">
            <Link
                href="/workflow/form-definitions"
                prefetch={false}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] hover:text-[#191c1e]"
            >
                <ArrowLeft className="h-4 w-4" /> {t("backToList")}
            </Link>

            <div className="flex flex-col gap-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold text-[#191c1e]">{formDefinition.nameVn}</h1>
                        <Badge variant={formDefinition.isPublished ? "success" : "neutral"} withDot>
                            {formDefinition.isPublished ? t("statusPublished") : t("statusDraft")}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#5e3f3a]">
                        {formDefinition.code} · {formDefinition.formCategoryNameVn} · v{formDefinition.version}
                    </p>
                    {formDefinition.description && <p className="mt-2 text-sm text-[#5e3f3a]">{formDefinition.description}</p>}
                </div>

                {canManage && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                            onClick={() => setCloneDialogOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Copy className="h-3.5 w-3.5" /> {t("cloneAction")}
                        </button>
                        <button
                            onClick={() => setPublishConfirmOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Rocket className="h-3.5 w-3.5" /> {formDefinition.isPublished ? t("republishAction") : t("publishAction")}
                        </button>
                        <button
                            onClick={() => setEditFormOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Pencil className="h-3.5 w-3.5" /> {t("editBasicInfo")}
                        </button>
                    </div>
                )}
            </div>

            <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

            <div>
                {activeTab === "fields" && (
                    <FormFieldDesigner formDefinitionId={formDefinition.id} layoutHtml={formDefinition.layoutHtml} onLayoutChange={refetch} />
                )}
                {activeTab === "conditions" && <FormFieldConditionsPanel formDefinitionId={formDefinition.id} />}
                {activeTab === "accesses" && <FormAccessesPanel formDefinitionId={formDefinition.id} />}
                {activeTab === "routes" && (
                    <FormApprovalRoutesPanel formDefinitionId={formDefinition.id} routeConditionType={formDefinition.routeConditionType} />
                )}
            </div>

            <FormDefinitionForm
                isOpen={editFormOpen}
                mode="edit"
                initial={formDefinition}
                formCategories={formCategories}
                loading={isSaving}
                onClose={() => !isSaving && setEditFormOpen(false)}
                onSubmit={handleUpdateBasicInfo}
            />

            <ConfirmDialog
                isOpen={publishConfirmOpen}
                title={formDefinition.isPublished ? t("republishConfirmTitle") : t("publishConfirmTitle")}
                message={formDefinition.isPublished ? t("republishConfirmMessage") : t("publishConfirmMessage")}
                approveLabel={formDefinition.isPublished ? t("republishAction") : t("publishAction")}
                deniedLabel={tCommon("cancel")}
                loading={isPublishing}
                onApprove={handlePublish}
                onDenied={() => {
                    if (!isPublishing) setPublishConfirmOpen(false);
                }}
            />

            {cloneDialogOpen && (
                <CloneFormDefinitionDialog
                    sourceNameVn={formDefinition.nameVn}
                    loading={isCloning}
                    onClose={() => !isCloning && setCloneDialogOpen(false)}
                    onSubmit={handleClone}
                />
            )}
        </div>
    );
}
