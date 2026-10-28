"use client";

import { useState, type ChangeEvent } from "react";
import { ArrowLeft, Save, Send, CheckCircle2, XCircle, RotateCcw, UserPlus, Ban, Printer, Paperclip, Download, Trash2, Eye, History } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { WorkflowRequestApi, type WorkflowRequestFormSchemaDto } from "@/modules/workflow/api/workflow-request.api";
import { EmployeeSignatureApi } from "@/modules/workflow/api/employee-signature.api";
import { ApprovalDelegationApi } from "@/modules/workflow/api/approval-delegation.api";
import { EmployeeApi } from "@/modules/workflow/api/employee.api";
import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import type { WorkflowRequestDto, MyEmployeeDto, JsonValue, WorkflowAttachmentDto } from "@/modules/workflow/types/workflow-request.dto";
import { RequestStatus, StepStatus, RequestAction } from "@/modules/workflow/types/workflow-request.dto";
import type { ApprovalDelegationDto } from "@/modules/workflow/types/approval-delegation.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import { ParticipantRole } from "@/modules/workflow/types/form-route.dto";
import DynamicFormRenderer from "./DynamicFormRenderer";
import DocumentFormRenderer from "./DocumentFormRenderer";
import WorkflowRequestDataView from "./WorkflowRequestDataView";
import WorkflowRequestPrintView from "./WorkflowRequestPrintView";
import AttachmentPreviewDialog from "./AttachmentPreviewDialog";
import SignatureUpload from "./SignatureUpload";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";

interface WorkflowRequestDetailProps {
    // id = null → đơn CHƯA tồn tại trong DB (mới chọn loại đơn, chưa "Lưu nháp"/"Nộp đơn" lần nào),
    // bắt buộc kèm formDefinitionId. Không gọi createDraft cho tới khi người dùng chủ động bấm 1 trong
    // 2 nút đó — tránh tạo rác WorkflowRequests chỉ vì bấm nhầm loại đơn (workflow-module.md §10).
    id: number | null;
    formDefinitionId?: number | null;
}

const STATUS_META: Record<number, { labelKey: string; variant: BadgeVariant }> = {
    [RequestStatus.Draft]: { labelKey: "statusDraft", variant: "neutral" },
    [RequestStatus.Submitted]: { labelKey: "statusSubmitted", variant: "info" },
    [RequestStatus.InProgress]: { labelKey: "statusInProgress", variant: "info" },
    [RequestStatus.Approved]: { labelKey: "statusApproved", variant: "success" },
    [RequestStatus.Rejected]: { labelKey: "statusRejected", variant: "danger" },
    [RequestStatus.SentBack]: { labelKey: "statusSentBack", variant: "warning" },
    [RequestStatus.Cancelled]: { labelKey: "statusCancelled", variant: "neutral" },
};

const STEP_STATUS_META: Record<number, { labelKey: string; variant: BadgeVariant }> = {
    [StepStatus.Waiting]: { labelKey: "stepWaiting", variant: "neutral" },
    [StepStatus.Current]: { labelKey: "stepCurrent", variant: "info" },
    [StepStatus.Approved]: { labelKey: "stepApproved", variant: "success" },
    [StepStatus.Rejected]: { labelKey: "stepRejected", variant: "danger" },
    [StepStatus.Skipped]: { labelKey: "stepSkipped", variant: "neutral" },
};

const ACTION_LABEL_KEY: Record<number, string> = {
    [RequestAction.Submit]: "actionSubmit",
    [RequestAction.Approve]: "actionApprove",
    [RequestAction.Reject]: "actionReject",
    [RequestAction.SendBack]: "actionSendBack",
    [RequestAction.Cancel]: "actionCancel",
    [RequestAction.AddApprover]: "actionAddApprover",
    [RequestAction.Comment]: "actionComment",
    [RequestAction.Resubmit]: "actionResubmit",
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function flattenOrgUnits(nodes: OrgUnitTreeDto[], depth = 0): SelectOption[] {
    const result: SelectOption[] = [];
    for (const node of nodes) {
        const label = `${"— ".repeat(depth)}${node.code} · ${node.nameVn}`;
        result.push({ value: node.id, label, searchText: `${node.code} ${node.nameVn}`.toLowerCase() });
        result.push(...flattenOrgUnits(node.children, depth + 1));
    }
    return result;
}

interface LoadedData {
    req: WorkflowRequestDto;
    formSchema: WorkflowRequestFormSchemaDto | null;
    employeeOptions: SelectOption[];
    orgUnitOptions: SelectOption[];
    myEmployee: MyEmployeeDto | null;
    delegations: ApprovalDelegationDto[];
}

export default function WorkflowRequestDetail({ id, formDefinitionId }: WorkflowRequestDetailProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const isNew = id === null;

    const [request, setRequest] = useState<WorkflowRequestDto | null>(null);
    const [formSchema, setFormSchema] = useState<WorkflowRequestFormSchemaDto | null>(null);
    const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
    const [orgUnitOptions, setOrgUnitOptions] = useState<SelectOption[]>([]);
    const [myEmployee, setMyEmployee] = useState<MyEmployeeDto | null>(null);
    const [delegations, setDelegations] = useState<ApprovalDelegationDto[]>([]);
    const [draftData, setDraftData] = useState<Record<string, JsonValue>>({});

    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

    const [comment, setComment] = useState("");
    const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
    const [savedSignatureBase64, setSavedSignatureBase64] = useState<string | null>(null);
    const [onBehalfOfEmployeeId, setOnBehalfOfEmployeeId] = useState<number | "">("");
    const [isApproving, setIsApproving] = useState(false);
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const [sendBackOpen, setSendBackOpen] = useState(false);
    const [sendBackTarget, setSendBackTarget] = useState<number>(0);
    const [isSendingBack, setIsSendingBack] = useState(false);

    const [addApproverOpen, setAddApproverOpen] = useState(false);
    const [addApproverEmployeeId, setAddApproverEmployeeId] = useState<number | "">("");
    const [addApproverInsertAfter, setAddApproverInsertAfter] = useState<number>(0);
    const [isAddingApprover, setIsAddingApprover] = useState(false);

    const [printOpen, setPrintOpen] = useState(false);

    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
    const [previewAttachment, setPreviewAttachment] = useState<WorkflowAttachmentDto | null>(null);

    const { isLoading, error, refetch } = useFetchEffect(
        async (): Promise<LoadedData> => {
            if (id === null) {
                if (!formDefinitionId) throw new Error(t("missingFormDefinition"));

                const [schema, employees, orgUnitTree] = await Promise.all([
                    WorkflowRequestApi.getFormSchema(formDefinitionId),
                    EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
                    OrgUnitApi.getOrgUnitTree(),
                ]);
                const employeeOptionsResult = employees.data
                    .filter((x) => x.isActive)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.employeeCode})`, searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase() }));

                // Object tạm — CHƯA có bản ghi thật trong DB, id=0 chỉ để thoả kiểu WorkflowRequestDto.
                // Mọi hành động (Huỷ, Duyệt...) đều bị chặn hiển thị vì status luôn là Draft rỗng.
                const req: WorkflowRequestDto = {
                    id: 0,
                    requestCode: null,
                    formDefinitionId,
                    formDefinitionNameVn: schema.nameVn,
                    formRouteId: null,
                    routeConditionSnapshot: null,
                    formVersion: 0,
                    dataJson: {},
                    formSchemaJson: null,
                    status: RequestStatus.Draft,
                    currentStepOrder: 0,
                    createdByEmployeeId: 0,
                    createdByEmployeeName: "",
                    createdByOrgUnitId: null,
                    createdByOrgUnitNameVn: null,
                    createdAt: new Date().toISOString(),
                    submittedAt: null,
                    completedAt: null,
                    steps: [],
                    histories: [],
                    attachments: [],
                };

                return { req, formSchema: schema, employeeOptions: employeeOptionsResult, orgUnitOptions: flattenOrgUnits(orgUnitTree), myEmployee: null, delegations: [] };
            }

            const req = await WorkflowRequestApi.getById(id);
            let formSchemaResult: WorkflowRequestFormSchemaDto | null = null;
            let employeeOptionsResult: SelectOption[] = [];
            let orgUnitOptionsResult: SelectOption[] = [];
            let myEmployeeResult: MyEmployeeDto | null = null;
            let delegationsResult: ApprovalDelegationDto[] = [];

            // SentBack needs both: the schema so the owner can edit the data, and myEmployee/delegations
            // to check whether the current viewer is the owner (attachments block).
            const needsEditableSchema = req.status === RequestStatus.Draft || req.status === RequestStatus.SentBack;
            const needsApprovalContext =
                req.status === RequestStatus.Submitted || req.status === RequestStatus.InProgress || req.status === RequestStatus.SentBack;

            if (needsEditableSchema || needsApprovalContext) {
                const [employees, schema, orgUnitTree, me, myDelegations] = await Promise.all([
                    EmployeeApi.getEmployeePageNation({ pageSize: 1000 }),
                    needsEditableSchema ? WorkflowRequestApi.getFormSchema(req.formDefinitionId) : Promise.resolve(null),
                    needsEditableSchema ? OrgUnitApi.getOrgUnitTree() : Promise.resolve<OrgUnitTreeDto[]>([]),
                    needsApprovalContext ? WorkflowRequestApi.getMyEmployee() : Promise.resolve(null),
                    needsApprovalContext ? ApprovalDelegationApi.getMine() : Promise.resolve<ApprovalDelegationDto[]>([]),
                ]);
                employeeOptionsResult = employees.data
                    .filter((x) => x.isActive)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.employeeCode})`, searchText: `${x.employeeCode} ${x.fullName}`.toLowerCase() }));
                formSchemaResult = schema;
                orgUnitOptionsResult = flattenOrgUnits(orgUnitTree);
                myEmployeeResult = me;
                delegationsResult = myDelegations;
            }

            return { req, formSchema: formSchemaResult, employeeOptions: employeeOptionsResult, orgUnitOptions: orgUnitOptionsResult, myEmployee: myEmployeeResult, delegations: delegationsResult };
        },
        [id, formDefinitionId],
        (result) => {
            setRequest(result.req);
            setFormSchema(result.formSchema);
            setEmployeeOptions(result.employeeOptions);
            setOrgUnitOptions(result.orgUnitOptions);
            setMyEmployee(result.myEmployee);
            setDelegations(result.delegations);
            setDraftData(result.req.dataJson ?? {});
            setComment("");
            setSignatureBase64(null);
            setOnBehalfOfEmployeeId("");
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    // Tải trước chữ ký đã đăng ký sẵn (EmployeeSignatures, Pha 4) để tự điền vào SignatureUpload thay
    // vì bắt tải ảnh lên mỗi lần duyệt — chỉ để hiển thị mặc định (initialBase64), KHÔNG ghi đè
    // signatureBase64 (giá trị người dùng chủ động chọn trong phiên này luôn thắng, xem handleApprove).
    // Im lặng khi lỗi/chưa đăng ký (không toast) — đây là trạng thái bình thường, không phải sự cố.
    const { isLoading: isSignatureLoading } = useFetchEffect(
        () => EmployeeSignatureApi.getMine(),
        [],
        (data) => setSavedSignatureBase64(data.signatureImage),
        "",
        undefined,
        "employee-signature"
    );

    if (isLoading) {
        return (
            <div className="space-y-3 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-4 h-32 w-full" />
            </div>
        );
    }
    if (error || !request) return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error ?? t("loadError")}</div>;

    const statusMeta = STATUS_META[request.status];
    const currentStep = request.steps.find((s) => s.stepOrder === request.currentStepOrder && s.status === StepStatus.Current) ?? null;
    const canAct = request.status === RequestStatus.Submitted || request.status === RequestStatus.InProgress;
    // Prevents starting a second action (e.g. Reject) while another one (e.g. Approve) is still in flight.
    const isActionInFlight = isApproving || isRejecting || isSendingBack || isAddingApprover;
    const canCancel = !isNew && request.status !== RequestStatus.Approved && request.status !== RequestStatus.Rejected && request.status !== RequestStatus.Cancelled;
    // Chủ đơn được thêm/xoá đính kèm xuyên suốt tới khi đơn kết thúc (workflow-module.md §10, Pha 4B) —
    // BE (GuardCanEditAttachments) là nguồn xác thực thật, điều kiện này chỉ để ẩn/hiện nút cho gọn UI.
    const canManageAttachments =
        !isNew &&
        request.status !== RequestStatus.Approved &&
        request.status !== RequestStatus.Rejected &&
        request.status !== RequestStatus.Cancelled &&
        (request.status === RequestStatus.Draft || myEmployee?.id === request.createdByEmployeeId);
    // UI-only gate for showing the edit/resubmit buttons — BE (UpdateDraftAsync/ResubmitAsync) enforces it for real.
    const canEditAndResubmit = !isNew && request.status === RequestStatus.SentBack && myEmployee?.id === request.createdByEmployeeId;

    const onBehalfOptions: SelectOption[] = (() => {
        if (!myEmployee || !currentStep) return [];
        const now = new Date();
        const unactedApproverIds = new Set(
            currentStep.participants.filter((p) => p.participantRole === ParticipantRole.Approver && p.actedAt === null).map((p) => p.employeeId)
        );
        return delegations
            .filter(
                (d) =>
                    d.delegateEmployeeId === myEmployee.id &&
                    new Date(d.fromDate) <= now &&
                    new Date(d.toDate) >= now &&
                    (d.formDefinitionId === null || d.formDefinitionId === request.formDefinitionId) &&
                    unactedApproverIds.has(d.delegatorEmployeeId)
            )
            .map((d) => ({ value: d.delegatorEmployeeId, label: d.delegatorEmployeeName, searchText: d.delegatorEmployeeName.toLowerCase() }));
    })();

    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        try {
            if (isNew) {
                const created = await WorkflowRequestApi.createDraft({ formDefinitionId: formDefinitionId as number, dataJson: draftData });
                toast.success(t("saveDraftSuccess"));
                router.replace({ pathname: "/workflow/requests/detail", query: { id: String(created.id) } });
            } else {
                await WorkflowRequestApi.updateDraft(request.id, { dataJson: draftData });
                toast.success(t("saveDraftSuccess"));
                await refetch();
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("saveDraftError")));
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (isNew) {
                const created = await WorkflowRequestApi.createDraft({ formDefinitionId: formDefinitionId as number, dataJson: draftData });
                await WorkflowRequestApi.submit(created.id);
                toast.success(t("submitSuccess"));
                router.replace({ pathname: "/workflow/requests/detail", query: { id: String(created.id) } });
            } else {
                await WorkflowRequestApi.updateDraft(request.id, { dataJson: draftData });
                await WorkflowRequestApi.submit(request.id);
                toast.success(t("submitSuccess"));
                await refetch();
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("submitError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResubmit = async () => {
        setIsResubmitting(true);
        try {
            await WorkflowRequestApi.updateDraft(request.id, { dataJson: draftData });
            await WorkflowRequestApi.resubmit(request.id, { comment: comment || null });
            toast.success(t("resubmitSuccess"));
            setComment("");
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("resubmitError")));
        } finally {
            setIsResubmitting(false);
        }
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await WorkflowRequestApi.cancel(request.id, { reason: comment || null });
            toast.success(t("cancelSuccess"));
            setCancelConfirmOpen(false);
            setComment("");
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("cancelError")));
        } finally {
            setIsCancelling(false);
        }
    };

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            await WorkflowRequestApi.approve(request.id, {
                comment: comment || null,
                signatureImageBase64: signatureBase64 ?? savedSignatureBase64,
                onBehalfOfEmployeeId: onBehalfOfEmployeeId === "" ? null : onBehalfOfEmployeeId,
            });
            toast.success(t("approveSuccess"));
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("approveError")));
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            toast.error(t("rejectCommentRequired"));
            return;
        }
        setIsRejecting(true);
        try {
            await WorkflowRequestApi.reject(request.id, {
                comment,
                onBehalfOfEmployeeId: onBehalfOfEmployeeId === "" ? null : onBehalfOfEmployeeId,
            });
            toast.success(t("rejectSuccess"));
            setRejectConfirmOpen(false);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("rejectError")));
        } finally {
            setIsRejecting(false);
        }
    };

    const handleSendBack = async () => {
        setIsSendingBack(true);
        try {
            await WorkflowRequestApi.sendBack(request.id, {
                targetStepOrder: sendBackTarget,
                comment: comment || null,
                onBehalfOfEmployeeId: onBehalfOfEmployeeId === "" ? null : onBehalfOfEmployeeId,
            });
            toast.success(t("sendBackSuccess"));
            setSendBackOpen(false);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("sendBackError")));
        } finally {
            setIsSendingBack(false);
        }
    };

    const handleAddApprover = async () => {
        if (addApproverEmployeeId === "") {
            toast.error(t("addApproverEmployeeRequired"));
            return;
        }
        setIsAddingApprover(true);
        try {
            await WorkflowRequestApi.addApprover(request.id, {
                employeeId: addApproverEmployeeId,
                insertAfterStepOrder: addApproverInsertAfter,
                nameVn: null,
                onBehalfOfEmployeeId: onBehalfOfEmployeeId === "" ? null : onBehalfOfEmployeeId,
            });
            toast.success(t("addApproverSuccess"));
            setAddApproverOpen(false);
            setAddApproverEmployeeId("");
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("addApproverError")));
        } finally {
            setIsAddingApprover(false);
        }
    };

    const handleUploadAttachment = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // reset để chọn lại đúng file cũ vẫn bắn onChange
        if (!file) return;
        setIsUploadingAttachment(true);
        try {
            await WorkflowRequestApi.uploadAttachment(request.id, file);
            toast.success(t("uploadAttachmentSuccess"));
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("uploadAttachmentError")));
        } finally {
            setIsUploadingAttachment(false);
        }
    };

    const handleDeleteAttachment = async (attachmentId: number) => {
        setDeletingAttachmentId(attachmentId);
        try {
            await WorkflowRequestApi.deleteAttachment(attachmentId);
            toast.success(t("deleteAttachmentSuccess"));
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteAttachmentError")));
        } finally {
            setDeletingAttachmentId(null);
        }
    };

    const handleDownloadAttachment = async (attachmentId: number, fallbackName: string) => {
        try {
            const { blob, fileName } = await WorkflowRequestApi.downloadAttachment(attachmentId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? fallbackName;
            link.click();
            // Revoking immediately can abort the download in some browsers before it starts reading the blob.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("downloadAttachmentError")));
        }
    };

    const sendBackOptions = [0, ...request.steps.filter((s) => s.stepOrder < request.currentStepOrder).map((s) => s.stepOrder)];

    return (
        <>
        <div className="space-y-6 print:hidden">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <Link href="/workflow/requests" className="flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] hover:text-[#191c1e]">
                        <ArrowLeft className="h-3.5 w-3.5" /> {t("backToList")}
                    </Link>
                    <div className="mt-2 flex items-center gap-3">
                        <h1 className="text-2xl font-semibold text-[#191c1e]">{request.requestCode ?? t("draftLabel")}</h1>
                        <Badge variant={statusMeta?.variant ?? "neutral"} withDot>
                            {statusMeta ? t(statusMeta.labelKey) : request.status}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#5e3f3a]">{request.formDefinitionNameVn}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {request.status !== RequestStatus.Draft && request.formSchemaJson && (
                        <button
                            onClick={() => setPrintOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Printer className="h-3.5 w-3.5" /> {t("printButton")}
                        </button>
                    )}
                    {canCancel && (
                        <button
                            onClick={() => setCancelConfirmOpen(true)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e9bcb6] bg-white px-3 py-1.5 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                        >
                            <Ban className="h-3.5 w-3.5" /> {t("cancelButton")}
                        </button>
                    )}
                </div>
            </div>

            {request.status === RequestStatus.SentBack && (
                <div className="rounded-lg border border-[#f5d0a9] bg-[#fff8ee] px-4 py-3 text-sm text-[#8a5a00]">
                    {canEditAndResubmit ? t("sentBackEditableNotice") : t("sentBackNotice")}
                </div>
            )}

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("dataSectionTitle")}</h2>
                {(request.status === RequestStatus.Draft || (request.status === RequestStatus.SentBack && canEditAndResubmit)) && formSchema?.layoutHtml ? (
                    <DocumentFormRenderer
                        layoutHtml={formSchema.layoutHtml}
                        fields={formSchema.fields}
                        conditions={formSchema.conditions}
                        value={draftData}
                        onChange={setDraftData}
                        employeeOptions={employeeOptions}
                        orgUnitOptions={orgUnitOptions}
                    />
                ) : (request.status === RequestStatus.Draft || (request.status === RequestStatus.SentBack && canEditAndResubmit)) && formSchema ? (
                    <DynamicFormRenderer
                        fields={formSchema.fields}
                        conditions={formSchema.conditions}
                        value={draftData}
                        onChange={setDraftData}
                        employeeOptions={employeeOptions}
                        orgUnitOptions={orgUnitOptions}
                    />
                ) : request.formSchemaJson ? (
                    <WorkflowRequestDataView schema={request.formSchemaJson} data={request.dataJson ?? {}} />
                ) : (
                    <p className="text-sm text-[#8a8f94]">{t("noSchema")}</p>
                )}
            </section>

            {!isNew && (
                <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("attachmentsSectionTitle")}</h2>
                        {canManageAttachments && (
                            <label
                                className={`flex items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] ${
                                    isUploadingAttachment ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                }`}
                            >
                                <Paperclip className="h-3.5 w-3.5" />
                                {isUploadingAttachment ? tCommon("processing") : t("addAttachmentButton")}
                                <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={isUploadingAttachment} />
                            </label>
                        )}
                    </div>
                    {request.attachments.length === 0 ? (
                        <EmptyState icon={Paperclip} title={t("noAttachments")} />
                    ) : (
                        <ul className="space-y-2">
                            {request.attachments.map((a) => (
                                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e0e3e5] px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[#191c1e]">{a.originalFileName}</p>
                                        <p className="text-xs text-[#8a8f94]">
                                            {formatFileSize(a.fileSizeBytes)} · {a.uploadedByEmployeeName} · {new Date(a.uploadedAt).toLocaleString("vi-VN")}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            onClick={() => setPreviewAttachment(a)}
                                            className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadAttachment(a.id, a.originalFileName)}
                                            className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                        {canManageAttachments && (
                                            <button
                                                onClick={() => handleDeleteAttachment(a.id)}
                                                disabled={deletingAttachmentId === a.id}
                                                className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e9bcb6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2] disabled:opacity-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {request.status === RequestStatus.Draft && (
                <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-[#e0e3e5] bg-[#f8fafc]/95 py-3 backdrop-blur">
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft || isSubmitting}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <Save className="h-3.5 w-3.5" /> {isSavingDraft ? tCommon("processing") : t("saveDraftButton")}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSavingDraft || isSubmitting}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                    >
                        <Send className="h-3.5 w-3.5" /> {isSubmitting ? tCommon("processing") : t("submitButton")}
                    </button>
                </div>
            )}

            {canEditAndResubmit && (
                <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-[#e0e3e5] bg-[#f8fafc]/95 py-3 backdrop-blur">
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft || isResubmitting}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <Save className="h-3.5 w-3.5" /> {isSavingDraft ? tCommon("processing") : t("saveEditButton")}
                    </button>
                    <button
                        onClick={handleResubmit}
                        disabled={isSavingDraft || isResubmitting}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                    >
                        <Send className="h-3.5 w-3.5" /> {isResubmitting ? tCommon("processing") : t("resubmitButton")}
                    </button>
                </div>
            )}

            {request.steps.length > 0 && (
                <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("stepsSectionTitle")}</h2>
                    <div className="space-y-3">
                        {request.steps
                            .slice()
                            .sort((a, b) => a.stepOrder - b.stepOrder)
                            .map((step) => {
                                const meta = STEP_STATUS_META[step.status];
                                return (
                                    <div key={step.id} className={`rounded-lg border p-3 ${step.status === StepStatus.Current ? "border-[#e3000f] bg-[#fff4f2]" : "border-[#e0e3e5]"}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-[#191c1e]">
                                                {t("stepOrderLabel", { order: step.stepOrder })} — {step.stepNameSnapshot}
                                                {step.isAdHoc && <span className="ml-1.5 text-xs font-normal text-[#8a8f94]">({t("adHocLabel")})</span>}
                                            </p>
                                            <Badge variant={meta?.variant ?? "neutral"}>{meta ? t(meta.labelKey) : step.status}</Badge>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {step.participants.map((p) => (
                                                <span
                                                    key={p.id}
                                                    className={`rounded-full border px-2.5 py-1 text-xs ${
                                                        p.actedAt ? "border-[#c9e5d0] bg-[#e6f4ea] text-[#1e7a34]" : "border-[#e0e3e5] bg-white text-[#5e3f3a]"
                                                    }`}
                                                >
                                                    {p.employeeFullName}
                                                    {p.resolvedFromJobTitle && ` (${p.resolvedFromJobTitle})`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </section>
            )}

            {canAct && currentStep && (
                <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("actionSectionTitle")}</h2>

                    {onBehalfOptions.length > 0 && (
                        <label className="mb-3 block max-w-sm">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("onBehalfOfLabel")}</span>
                            <SearchableSelect
                                options={onBehalfOptions}
                                value={onBehalfOfEmployeeId}
                                onChange={setOnBehalfOfEmployeeId}
                                placeholder={t("onBehalfOfPlaceholder")}
                            />
                        </label>
                    )}

                    <label className="mb-3 block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("commentLabel")}</span>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>

                    {currentStep.requireSignatureSnapshot && (
                        <div className="mb-3 max-w-sm">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("signatureLabel")}</span>
                            {isSignatureLoading ? (
                                <Skeleton className="h-20 w-full" />
                            ) : (
                                // Mounted only after the signature fetch settles, so its lazy initial state
                                // (SignatureUpload.tsx) never captures a stale null before the real value arrives.
                                <SignatureUpload onChange={setSignatureBase64} initialBase64={savedSignatureBase64} />
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleApprove}
                            disabled={isActionInFlight}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1e7a34] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#166028] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> {isApproving ? tCommon("processing") : t("approveButton")}
                        </button>
                        <button
                            onClick={() => setRejectConfirmOpen(true)}
                            disabled={isActionInFlight}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <XCircle className="h-3.5 w-3.5" /> {t("rejectButton")}
                        </button>
                        {currentStep.allowSendBackSnapshot && (
                            <button
                                onClick={() => {
                                    setSendBackTarget(0);
                                    setSendBackOpen(true);
                                }}
                                disabled={isActionInFlight}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RotateCcw className="h-3.5 w-3.5" /> {t("sendBackButton")}
                            </button>
                        )}
                        {currentStep.allowAddApproverSnapshot && (
                            <button
                                onClick={() => {
                                    setAddApproverInsertAfter(request.currentStepOrder);
                                    setAddApproverOpen(true);
                                }}
                                disabled={isActionInFlight}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <UserPlus className="h-3.5 w-3.5" /> {t("addApproverButton")}
                            </button>
                        )}
                    </div>
                </section>
            )}

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#5e3f3a]">{t("historySectionTitle")}</h2>
                {request.histories.length === 0 ? (
                    <EmptyState icon={History} title={t("noHistory")} />
                ) : (
                    <div className="space-y-3">
                        {request.histories
                            .slice()
                            .sort((a, b) => new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime())
                            .map((h) => (
                                <div key={h.id} className="border-l-2 border-[#e0e3e5] pl-3">
                                    <p className="text-sm text-[#191c1e]">
                                        <span className="font-semibold">{h.actorNameSnapshot}</span> {t(ACTION_LABEL_KEY[h.action] ?? "actionComment")}
                                        {h.onBehalfOfEmployeeName && <span className="text-[#8a8f94]"> ({t("onBehalfOfHistorySuffix", { name: h.onBehalfOfEmployeeName })})</span>}
                                    </p>
                                    {h.comment && <p className="text-sm text-[#5e3f3a]">&quot;{h.comment}&quot;</p>}
                                    <p className="text-xs text-[#8a8f94]">{new Date(h.actionAt).toLocaleString("vi-VN")}</p>
                                </div>
                            ))}
                    </div>
                )}
            </section>

            <ConfirmDialog
                isOpen={cancelConfirmOpen}
                title={t("cancelConfirmTitle")}
                message={t("cancelConfirmMessage")}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isCancelling}
                onApprove={handleCancel}
                onDenied={() => {
                    if (!isCancelling) setCancelConfirmOpen(false);
                }}
            />

            <ConfirmDialog
                isOpen={rejectConfirmOpen}
                title={t("rejectConfirmTitle")}
                message={t("rejectConfirmMessage")}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isRejecting}
                onApprove={handleReject}
                onDenied={() => {
                    if (!isRejecting) setRejectConfirmOpen(false);
                }}
            />

            <FormDialog
                isOpen={sendBackOpen}
                title={t("sendBackDialogTitle")}
                onClose={() => setSendBackOpen(false)}
                onSubmit={handleSendBack}
                loading={isSendingBack}
                submitLabel={isSendingBack ? tCommon("processing") : tCommon("confirm")}
                cancelLabel={tCommon("cancel")}
            >
                <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("sendBackTargetLabel")}</span>
                    <select
                        value={sendBackTarget}
                        onChange={(e) => setSendBackTarget(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                    >
                        {sendBackOptions.map((order) => (
                            <option key={order} value={order}>
                                {order === 0 ? t("sendBackToSubmitter") : t("stepOrderLabel", { order })}
                            </option>
                        ))}
                    </select>
                </label>
            </FormDialog>

            <FormDialog
                isOpen={addApproverOpen}
                title={t("addApproverDialogTitle")}
                onClose={() => setAddApproverOpen(false)}
                onSubmit={handleAddApprover}
                loading={isAddingApprover}
                submitLabel={isAddingApprover ? tCommon("processing") : tCommon("confirm")}
                cancelLabel={tCommon("cancel")}
            >
                <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("addApproverEmployeeLabel")}</span>
                    <SearchableSelect options={employeeOptions} value={addApproverEmployeeId} onChange={setAddApproverEmployeeId} placeholder={t("selectPlaceholder")} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-[#8a8f94]">{t("addApproverInsertAfterLabel")}</span>
                    <select
                        value={addApproverInsertAfter}
                        onChange={(e) => setAddApproverInsertAfter(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm outline-none focus:border-[#e3000f]"
                    >
                        {request.steps
                            .slice()
                            .sort((a, b) => a.stepOrder - b.stepOrder)
                            .map((s) => (
                                <option key={s.id} value={s.stepOrder}>
                                    {t("stepOrderLabel", { order: s.stepOrder })} — {s.stepNameSnapshot}
                                </option>
                            ))}
                    </select>
                </label>
            </FormDialog>

        </div>

        {printOpen && request.formSchemaJson && (
            <WorkflowRequestPrintView request={request} onClose={() => setPrintOpen(false)} />
        )}

        {previewAttachment && <AttachmentPreviewDialog attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
        </>
    );
}
