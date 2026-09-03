"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { Car, Check, Clock, History, MessageCircle, Printer, Search, Trash2, UserPlus, UserX, Utensils, X } from "lucide-react";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalStepDto, OtFormDto, OtFormEditLogDto, OtFormEmployeeDto } from "@/modules/attendance/types/ot-form.dto";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import { approvalActionLabels, otFormStatusClasses, otFormStatusLabels } from "@/modules/attendance/types/enums";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { formatHours } from "@/modules/attendance/lib/time";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter, getPathname } from "@/navigation";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import AccumulationHistoryModal from "@/modules/attendance/components/employees/AccumulationHistoryModal";
import { MealTicketTypeBadge } from "@/modules/attendance/components/ot-form/MealTicketTypeBadge";

interface OtFormDetailProps {
    id: number;
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

function formatTime(value: string) {
    return value?.slice(0, 5) ?? "-";
}

type ApprovalStepState = "done" | "current" | "rejected" | "skipped" | "upcoming";

interface ApprovalStepView {
    step: OtFormApprovalStepDto;
    state: ApprovalStepState;
    history: OtFormDto["approvalHistories"][number] | null;
}

// Chuỗi bước duyệt của 1 đơn ĐÃ được snapshot sẵn ở form.approvalSteps (sắp theo stepOrder, xem
// docs §Cây chức vụ) — không còn suy từ requiredApprovalLevel/danh sách cấp cố định như trước
// (2026-08-07, Giai đoạn 3.1). Trạng thái từng bước lấy TRỰC TIẾP từ step.status.
function buildApprovalSteps(form: OtFormDto): ApprovalStepView[] {
    const firstPendingOrder = form.approvalSteps.find((s) => s.status === 0)?.stepOrder;
    return form.approvalSteps.map((step): ApprovalStepView => {
        const history = form.approvalHistories.find((item) => item.stepOrder === step.stepOrder) ?? null;
        if (step.status === 2) return { step, history, state: "rejected" };
        if (step.status === 3) return { step, history, state: "skipped" };
        if (step.status === 1) return { step, history, state: "done" };
        return { step, history: null, state: step.stepOrder === firstPendingOrder ? "current" : "upcoming" };
    });
}

// employee.removedAtLevel giờ lưu StepOrder (đổi ý nghĩa 2026-08-07, xem ot-form.dto.ts) — tra lại
// tên Chức vụ của bước đó trong chuỗi đã snapshot của CHÍNH đơn này.
function stepNameByOrder(form: OtFormDto, stepOrder: number | null): string {
    if (stepOrder === null) return "";
    return form.approvalSteps.find((s) => s.stepOrder === stepOrder)?.jobTitleNameSnapshot ?? `#${stepOrder}`;
}

// Ô hiển thị 1 mục trong "Yêu cầu hỗ trợ khác" (ăn uống/xe đưa đón/phòng copy) — badge màu xanh lá khi
// Có, xám khi Không (mặc định khi form.processPart null), thay vì chuỗi text phẳng như trước.
function ProcessPartTile({
    icon,
    label,
    active,
    activeLabel,
    inactiveLabel,
}: {
    icon: ReactNode;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-[#191c1e]">
                <span className="text-[#5e3f3a]">{icon}</span>
                {label}
            </span>
            <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-[#e0e3e5] bg-white text-[#8a8f94]"
                }`}
            >
                {active ? <Check size={12} /> : <X size={12} />}
                {active ? activeLabel : inactiveLabel}
            </span>
        </div>
    );
}

export default function OtFormDetail({ id }: OtFormDetailProps) {
    const t = useTranslations("Attendance.OtFormDetail");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const router = useRouter();
    const locale = useLocale();
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [hasMySignature, setHasMySignature] = useState<boolean | null>(null);
    const [hasSecondaryPassword, setHasSecondaryPassword] = useState<boolean | null>(null);
    // Ngưỡng cảnh báo lũy kế lấy từ cấu hình (Admin sửa được), không còn hardcode 25/300.
    const { setting } = useAttendanceSetting();

    const [actionOpen, setActionOpen] = useState<"approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Loại 1 nhân viên khỏi đơn — modal RIÊNG với submit/approve/reject (docs §4.5a), người dùng đã
    // chốt luồng 2 bước: loại xong xem lại đơn rồi mới bấm Duyệt, không gộp vào modal Duyệt.
    // Không yêu cầu mật khẩu cấp 2 (khác Duyệt/Từ chối) — chốt lại 2026-07-31, áp dụng cho cả kênh
    // trong app lẫn email.
    const [removeTarget, setRemoveTarget] = useState<OtFormEmployeeDto | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [removeSecondaryPassword, setRemoveSecondaryPassword] = useState("");
    const [isRemovingEmployee, setIsRemovingEmployee] = useState(false);

    // Thêm nhân viên vào đơn — chiều ngược của Loại nhân viên (mới 2026-08-28, theo yêu cầu người
    // dùng). Tìm theo Mã nhân viên/tên: đơn theo chuyền dùng ProductionEmployeeApi.search (đã hỗ trợ
    // tìm theo Mã), đơn theo Nhóm dùng EmployeeApi.getEmployeesByGroup rồi lọc client-side (danh sách
    // 1 Nhóm thường nhỏ).
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [addSearchKeyword, setAddSearchKeyword] = useState("");
    const [addSearchResults, setAddSearchResults] = useState<{ employeeId: number; employeeCode: string; fullName: string }[]>([]);
    const [isSearchingAddEmployee, setIsSearchingAddEmployee] = useState(false);
    const [addSelectedEmployee, setAddSelectedEmployee] = useState<{ employeeId: number; employeeCode: string; fullName: string } | null>(
        null
    );
    const [addEndTime, setAddEndTime] = useState("");
    const [addDidEat, setAddDidEat] = useState(false);
    const [addNoteVn, setAddNoteVn] = useState("");
    const [addNoteJp, setAddNoteJp] = useState("");
    const [addSecondaryPassword, setAddSecondaryPassword] = useState("");
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);

    // Admin xoá đơn kẹt vĩnh viễn trong chuỗi duyệt (2026-08-08) — xem docs/attendance-module.md
    // §Cây chức vụ. BE chặn Completed (đã cộng lũy kế thật); FE ẩn luôn nút cho gọn thay vì để user
    // bấm rồi mới nhận lỗi 400.
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState("");
    const [isDeletingForm, setIsDeletingForm] = useState(false);

    // Xem lịch sử lũy kế theo tháng/năm của 1 nhân viên trong đơn (2026-08-11d) — chỉ người có quyền
    // duyệt mới thấy nút này (xem canApprove bên dưới), modal dùng chung với EmployeeList.tsx.
    const [historyEmployee, setHistoryEmployee] = useState<OtFormEmployeeDto | null>(null);

    const { isLoading, error, refetch: fetchForm } = useFetchEffect(
        () => OtFormApi.getOtFormById(id),
        [id],
        (data) => setForm(data),
        t("loadError"),
        undefined,
        "ot-form-detail"
    );

    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    // Bước đang chờ xử lý — StepOrder nhỏ nhất còn Pending trong chuỗi đã snapshot (xem docs §Cây
    // chức vụ). null khi đơn đã Hoàn tất/Từ chối hoặc chuỗi rỗng (đơn tự Hoàn tất ngay lúc tạo).
    const currentStep = form?.approvalSteps.find((s) => s.status === 0) ?? null;
    const showApprovalActions = canApprove && form?.status === 0 && currentStep !== null;
    const requireSignatureToApprove = currentStep?.requiresSignatureSnapshot ?? false;

    // Nút "Sửa" (docs §1.2): isEditable=true + có quyền tạo đơn. Đơn theo Nhóm còn phải là chính người
    // tạo; đơn "theo chuyền" (Giai đoạn 5, 2026-08-27) sửa được theo TỪNG BƯỚC — giống cách nút Duyệt/
    // Từ chối bên dưới cũng không tự lọc theo candidate ở FE, để BE là nguồn chặn thật (trả lỗi rõ ràng
    // nếu bấm Sửa mà không phải candidate của bước hiện tại).
    const canEdit =
        Boolean(form?.isEditable) &&
        hasPermission(user, "Attendance.OTForm.Create") &&
        (form?.isProductionForm || form?.createdByUserName === user?.userName);

    // Nút "Xoá đơn" (Admin only, mới 2026-08-08) — chặn khi đã Completed (status=1, đã cộng lũy kế thật).
    const canDelete = hasPermission(user, "Attendance.OTForm.Delete") && form?.status !== 1;

    // Nút "Loại khỏi đơn" trên từng dòng nhân viên (docs §4.5a) — hiện đúng lúc caller đang ở đúng
    // bước có thể duyệt đơn này VÀ có permission riêng Attendance.OTForm.RemoveEmployee — permission
    // này KHÔNG cấp cho Role "Nhân viên" (chỉ tạo đơn, không duyệt) nên thực chất không cần lọc thêm
    // ở đây, permission check là đủ.
    const canRemoveEmployee = hasPermission(user, "Attendance.OTForm.RemoveEmployee") && showApprovalActions;

    // Nút "Thêm nhân viên" (mới 2026-08-28) — cùng điều kiện phân quyền với Loại nhân viên (candidate
    // của bước đang chờ hiện tại + permission riêng Attendance.OTForm.AddEmployee).
    const canAddEmployee = hasPermission(user, "Attendance.OTForm.AddEmployee") && showApprovalActions;

    // Đơn "theo chuyền": hiện Line/Team/Nhóm ca ở cả khối "Thông tin đơn" (giá trị phân biệt gộp từ
    // toàn bộ nhân viên còn active) lẫn từng dòng trong bảng danh sách — trước đó màn Chi tiết đơn
    // format y hệt đơn "theo Nhóm" dù dữ liệu snapshot đã có sẵn trên OtFormEmployeeDto, không hiện gì
    // cho biết đây là đơn dưới chuyền (2026-08-29, theo phản hồi người dùng).
    const productionSummary = useMemo(() => {
        if (!form?.isProductionForm) return null;
        const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => Boolean(v))));
        const activeEmployees = form.employees.filter((e) => !e.isRemoved);
        return {
            lines: distinct(activeEmployees.map((e) => e.blockCodeSnapshot)),
            teams: distinct(activeEmployees.map((e) => e.teamCodeSnapshot)),
            shiftTeams: distinct(activeEmployees.map((e) => e.shiftTeamCodeSnapshot)),
        };
    }, [form]);

    const openAction = (type: "approve" | "reject") => {
        setComment("");
        setSecondaryPassword("");
        setActionOpen(type);
        if (type === "approve") {
            UserSignatureApi.getMySignature()
                .then((data) => setHasMySignature(Boolean(data)))
                .catch(() => setHasMySignature(false));
        }
        // Mật khẩu cấp 2 áp dụng cho CẢ 2 hành động (approve/reject) — xem
        // docs/docs-be/attendance-module.md — Mật khẩu cấp 2.
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    };

    const closeAction = () => {
        if (isSubmittingAction) return;
        setActionOpen(null);
    };

    const handleApprove = async () => {
        if (requireSignatureToApprove && hasMySignature === false) {
            toast.error(t("approveSignatureMissingError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.approveOtForm(id, { comment: comment.trim() || null, secondaryPassword });
            toast.success(t("approveSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("approveError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            toast.error(t("rejectCommentRequiredError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmittingAction(true);
        try {
            await OtFormApi.rejectOtForm(id, { comment: comment.trim(), secondaryPassword });
            toast.success(t("rejectSuccess"));
            setActionOpen(null);
            await fetchForm();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("rejectError")));
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const openRemove = (employee: OtFormEmployeeDto) => {
        setRemoveReason("");
        setRemoveSecondaryPassword("");
        setRemoveTarget(employee);
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    };

    const closeRemove = () => {
        if (isRemovingEmployee) return;
        setRemoveTarget(null);
    };

    const handleRemoveEmployee = async () => {
        if (!removeTarget) return;
        if (!removeReason.trim()) {
            toast.error(t("removeReasonRequiredError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!removeSecondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsRemovingEmployee(true);
        try {
            const updated = await OtFormApi.removeOtFormEmployee(id, {
                employeeId: removeTarget.employeeId,
                reason: removeReason.trim(),
                secondaryPassword: removeSecondaryPassword,
            });
            toast.success(t("removeSuccess", { name: removeTarget.fullName }));
            setForm(updated);
            setRemoveTarget(null);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("removeError")));
        } finally {
            setIsRemovingEmployee(false);
        }
    };

    const openAddEmployee = () => {
        setAddSearchKeyword("");
        setAddSearchResults([]);
        setAddSelectedEmployee(null);
        setAddEndTime(form ? form.endTime.slice(0, 5) : "");
        setAddDidEat(false);
        setAddNoteVn("");
        setAddNoteJp("");
        setAddSecondaryPassword("");
        setAddEmployeeOpen(true);
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    };

    const closeAddEmployee = () => {
        if (isAddingEmployee) return;
        setAddEmployeeOpen(false);
    };

    const handleSearchAddEmployee = async () => {
        if (!form) return;
        setIsSearchingAddEmployee(true);
        try {
            const activeIds = new Set(activeEmployees.map((employee) => employee.employeeId));
            const keyword = addSearchKeyword.trim();
            if (form.isProductionForm) {
                const results = await ProductionEmployeeApi.search({ keyword: keyword || undefined, date: form.date });
                setAddSearchResults(
                    results
                        .filter((item) => !activeIds.has(item.employeeId))
                        .map((item) => ({ employeeId: item.employeeId, employeeCode: item.employeeCode, fullName: item.fullName }))
                );
            } else if (form.groupId) {
                const results = await EmployeeApi.getEmployeesByGroup(form.groupId, form.date);
                const lowerKeyword = keyword.toLowerCase();
                setAddSearchResults(
                    results
                        .filter((item) => !activeIds.has(item.id))
                        .filter(
                            (item) =>
                                !lowerKeyword ||
                                item.code.toLowerCase().includes(lowerKeyword) ||
                                `${item.lastName} ${item.firstName}`.toLowerCase().includes(lowerKeyword)
                        )
                        .map((item) => ({ employeeId: item.id, employeeCode: item.code, fullName: `${item.lastName} ${item.firstName}` }))
                );
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("addSearchError")));
        } finally {
            setIsSearchingAddEmployee(false);
        }
    };

    const handleAddEmployee = async () => {
        if (!addSelectedEmployee) return;
        if (!addEndTime) {
            toast.error(t("addEndTimeRequiredError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (!addSecondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsAddingEmployee(true);
        try {
            const updated = await OtFormApi.addOtFormEmployee(id, {
                employeeId: addSelectedEmployee.employeeId,
                endTime: `${addEndTime}:00`,
                didEat: addDidEat,
                noteVn: addNoteVn.trim() || null,
                noteJp: addNoteJp.trim() || null,
                secondaryPassword: addSecondaryPassword,
            });
            toast.success(t("addEmployeeSuccess", { name: addSelectedEmployee.fullName }));
            setForm(updated);
            setAddEmployeeOpen(false);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("addEmployeeError")));
        } finally {
            setIsAddingEmployee(false);
        }
    };

    // Nhãn hiển thị 1 dòng Lịch sử chỉnh sửa (mới 2026-08-28) — actionType: 0=TimeChanged,
    // 1=NoteChanged, 2=EmployeeAdded, 3=EmployeeRemoved (enum OtFormEditActionType).
    const editLogActionLabel = (log: OtFormEditLogDto) => {
        if (log.actionType === 2) return t("editLogEmployeeAdded");
        if (log.actionType === 3) return t("editLogEmployeeRemoved");
        if (log.fieldName === "EndTime") return t("editLogFieldEndTime");
        if (log.fieldName === "DidEat") return t("editLogFieldDidEat");
        if (log.fieldName === "NoteVn") return t("editLogFieldNoteVn");
        if (log.fieldName === "NoteJp") return t("editLogFieldNoteJp");
        return log.fieldName ?? "";
    };

    const openDeleteModal = () => {
        setDeleteReason("");
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (isDeletingForm) return;
        setIsDeleteModalOpen(false);
    };

    const handleDeleteForm = async () => {
        if (!deleteReason.trim()) {
            toast.error(t("deleteReasonRequiredError"));
            return;
        }
        setIsDeletingForm(true);
        try {
            await OtFormApi.deleteOtForm(id, { reason: deleteReason.trim() });
            toast.success(t("deleteSuccess"));
            router.push({ pathname: "/ot/list" });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeletingForm(false);
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (error || !form) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>;
    }

    const approvalStepViews = buildApprovalSteps(form);
    // Người đã bị loại khỏi đơn KHÔNG tính vào tổng giờ OT — họ không còn nằm trong đơn được duyệt
    // (docs §4.5a). Vẫn hiện dòng của họ trong bảng bên dưới để giữ dấu vết ai loại/khi nào/vì sao.
    const activeEmployees = form.employees.filter((employee) => !employee.isRemoved);
    const totalWorkedHours = activeEmployees.reduce((sum, employee) => sum + employee.actualHours, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("titleWithId", { id: form.id })}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        {bilingualText(form.departmentNameVn, form.departmentNameJp)} — {bilingualText(form.groupNameVn, form.groupNameJp)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                    >
                        {otFormStatusLabels[form.status] ?? t("unknownStatus")}
                    </span>
                    {canEdit && (
                        <button
                            onClick={() => router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } })}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {t("editButton")}
                        </button>
                    )}
                    <button
                        onClick={() =>
                            window.open(
                                getPathname({ href: { pathname: "/ot-print", query: { id: String(form.id) } }, locale }),
                                "_blank",
                                "noopener,noreferrer"
                            )
                        }
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        {t("printButton")}
                    </button>
                    {canDelete && (
                        <button
                            onClick={openDeleteModal}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#930006] bg-white px-3 py-1.5 text-xs font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> {t("deleteButton")}
                        </button>
                    )}
                </div>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("approvalProgressTitle")}</h2>
                {form.approvalChainWarning && (
                    <div className="mb-4 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-3 py-2 text-xs text-[#9a5b00]">
                        {form.approvalChainWarning}
                    </div>
                )}
                <div className="flex overflow-x-auto pb-1">
                    {approvalStepViews.map((view, index) => (
                        <div key={view.step.id} className="relative flex min-w-[6.5rem] flex-1 flex-col items-center">
                            {index > 0 && (
                                <div
                                    className={`absolute left-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                        approvalStepViews[index - 1].state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                    }`}
                                />
                            )}
                            {index < approvalStepViews.length - 1 && (
                                <div
                                    className={`absolute right-0 top-4 h-0.5 w-1/2 -translate-y-1/2 ${
                                        view.state === "done" ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                    }`}
                                />
                            )}
                            <div
                                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                    view.state === "done"
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : view.state === "rejected"
                                        ? "border-[#930006] bg-[#930006] text-white"
                                        : view.state === "current"
                                        ? "border-[#9a5b00] bg-[#fff4e5] text-[#9a5b00]"
                                        : "border-[#e0e3e5] bg-white text-[#9aa0a6]"
                                }`}
                            >
                                {view.state === "done" && <Check size={16} />}
                                {view.state === "rejected" && <X size={16} />}
                                {view.state === "current" && <Clock size={16} />}
                                {(view.state === "upcoming" || view.state === "skipped") && index + 1}
                            </div>
                            <div
                                className={`mt-2 text-center text-xs font-semibold ${
                                    view.state === "upcoming" || view.state === "skipped" ? "text-[#9aa0a6]" : "text-[#191c1e]"
                                }`}
                            >
                                {view.step.jobTitleNameSnapshot}
                            </div>
                            {view.history ? (
                                <div className="mt-0.5 text-center text-[11px] leading-tight text-[#5e3f3a]">
                                    {view.history.approverFullName ?? view.history.approverUserName}
                                    <br />
                                    {formatDateTime(view.history.actionAt)}
                                </div>
                            ) : view.state === "current" ? (
                                <div
                                    className="mt-0.5 text-center text-[11px] text-[#9a5b00]"
                                    title={
                                        view.step.candidates.length > 1
                                            ? t("waitingCandidatesTooltip", {
                                                  names: view.step.candidates.map((c) => c.fullName).join(", "),
                                              })
                                            : undefined
                                    }
                                >
                                    {view.step.candidates.length > 1
                                        ? t("waitingShortMulti", { count: view.step.candidates.length })
                                        : t("waitingShort")}
                                </div>
                            ) : view.state === "skipped" ? (
                                <div className="mt-0.5 text-center text-[11px] text-[#9aa0a6]">{t("skippedShort")}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("otCaseLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.otCaseCode}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("reasonLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{bilingualText(form.reasonNameVn, form.reasonNameJp)}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("dateLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{formatDate(form.date)}</div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("timeLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">
                        {formatTime(form.startTime)} — {formatTime(form.endTime)} ({form.totalHour}h)
                    </div>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("createdByLabel")}</div>
                    <div className="mt-1 text-sm text-[#191c1e]">{form.createdByFullName ?? form.createdByUserName}</div>
                </div>
                {productionSummary && (
                    <>
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("colBlockCode")}</div>
                            <div className="mt-1 text-sm text-[#191c1e]">{productionSummary.lines.join(", ") || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("colTeamCode")}</div>
                            <div className="mt-1 text-sm text-[#191c1e]">{productionSummary.teams.join(", ") || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("colShiftTeam")}</div>
                            <div className="mt-1 text-sm text-[#191c1e]">{productionSummary.shiftTeams.join(", ") || "—"}</div>
                        </div>
                    </>
                )}
                {form.subReason && (
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("subReasonLabel")}</div>
                        <div className="mt-1 text-sm text-[#191c1e]">{form.subReason}</div>
                    </div>
                )}
            </section>

            {/* Luôn hiện khối này, kể cả khi form.processPart null (đơn không yêu cầu hỗ trợ gì thêm) —
                mặc định "Không" cho 3 checkbox, cùng cách OtFormPrintView.tsx đã xử lý từ trước
                (processPart?.isEat ?? false). Trước đây ẩn hẳn cả khối khi null, khiến người dùng
                tưởng thiếu thông tin dù đây là giá trị mặc định hợp lệ, không phải dữ liệu bị mất. */}
            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("processPartTitle")}</h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <ProcessPartTile
                        icon={<Utensils size={16} />}
                        label={t("eatFieldLabel")}
                        active={Boolean(form.processPart?.isEat)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                    <ProcessPartTile
                        icon={<Car size={16} />}
                        label={t("transportationFieldLabel")}
                        active={Boolean(form.processPart?.isTransportation)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                    <ProcessPartTile
                        icon={<Printer size={16} />}
                        label={t("copyRoomFieldLabel")}
                        active={Boolean(form.processPart?.isUseCopyRoom)}
                        activeLabel={t("yes")}
                        inactiveLabel={t("no")}
                    />
                </div>
                {form.processPart?.isEat && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("mainTicketLabel", { count: form.processPart.mainTicketCount })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("secondaryTicketLabel", { count: form.processPart.secondaryTicketCount })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            {t("milkLabel", { count: form.processPart.milkCount })}
                        </span>
                    </div>
                )}
                {form.processPart?.anotherSuggestionVn && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#5e3f3a]">
                        <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#5e3f3a]" />
                        <span>
                            <span className="font-semibold text-[#191c1e]">{t("anotherSuggestionFieldLabel")}: </span>
                            {bilingualText(form.processPart.anotherSuggestionVn, form.processPart.anotherSuggestionJp)}
                        </span>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("employeeListTitle", { count: form.numberOfEmployee })}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs font-semibold text-[#191c1e]">
                            {t("totalWorkedHoursLabel", { hours: formatHours(totalWorkedHours) })}
                        </span>
                        {canAddEmployee && (
                            <button
                                type="button"
                                onClick={openAddEmployee}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                            >
                                <UserPlus className="h-3.5 w-3.5" /> {t("addEmployeeButton")}
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colEmployeeCode")}</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colFullName")}</th>
                                {form.isProductionForm && (
                                    <>
                                        <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colBlockCode")}</th>
                                        <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colTeamCode")}</th>
                                        <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colShiftTeam")}</th>
                                    </>
                                )}
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colTime")}</th>
                                <th rowSpan={2} className="px-6 py-3 text-center align-bottom">{t("colHours")}</th>
                                <th colSpan={2} className="border-b border-[#e0e3e5] px-6 py-2 text-center">{t("colAccumulation")}</th>
                                <th rowSpan={2} className="px-6 py-3 text-center align-bottom">{t("colMeal")}</th>
                                <th rowSpan={2} className="px-6 py-3 text-center align-bottom">{t("colDidEat")}</th>
                                <th rowSpan={2} className="px-6 py-3 align-bottom">{t("colNote")}</th>
                                {canRemoveEmployee && <th rowSpan={2} className="px-6 py-3 align-bottom" />}
                            </tr>
                            <tr className="border-b border-[#e0e3e5] bg-[#fbfcfd] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-2 text-center">{t("colMonth")}</th>
                                <th className="px-6 py-2 text-center">{t("colYear")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.employees.map((employee) => {
                                const isMonthOverLimit = employee.monthToDate > setting.monthlyOtHourLimit;
                                const isYearOverLimit = employee.yearToDate > setting.yearlyOtHourLimit;
                                const isOverLimit = isMonthOverLimit || isYearOverLimit;
                                const hours = employee.actualHours;
                                // Đã bị loại khỏi đơn (docs §4.5a) — vẫn hiện dòng để giữ dấu vết, nhưng
                                // làm mờ + gạch ngang, thay toàn bộ cột số liệu bằng lý do/người loại.
                                if (employee.isRemoved) {
                                    return (
                                        <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#f8fafc] opacity-60">
                                            <td className="px-6 py-3 text-sm">
                                                <span className="inline-flex items-center rounded-md bg-[#eceef0] px-2 py-0.5 font-mono text-xs font-semibold text-[#191c1e] line-through">
                                                    {employee.employeeCode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-medium text-[#191c1e] line-through">{employee.fullName}</td>
                                            <td colSpan={form.isProductionForm ? 9 : 6} className="px-6 py-3 text-sm text-[#930006]">
                                                {t("removedInlineNote", {
                                                    name: employee.removedByFullName ?? employee.removedByUserName ?? "",
                                                    level: stepNameByOrder(form, employee.removedAtLevel),
                                                    reason: employee.removeReason ?? "",
                                                })}
                                                {employee.removedAt && (
                                                    <span className="ml-2 text-[#9aa0a6]">({formatDateTime(employee.removedAt)})</span>
                                                )}
                                            </td>
                                            {canRemoveEmployee && <td className="px-6 py-3" />}
                                        </tr>
                                    );
                                }
                                return (
                                    <tr
                                        key={employee.employeeId}
                                        className={`border-b border-[#f1f5f9] transition-colors ${
                                            isOverLimit ? "bg-[#fff4f2] hover:bg-[#ffe9e6]" : "hover:bg-[#f8fafc]"
                                        }`}
                                    >
                                        <td className="px-6 py-3 text-sm">
                                            <span className="inline-flex items-center whitespace-nowrap rounded-md bg-[#eceef0] px-3 py-1 font-mono text-xs font-semibold text-[#191c1e]">
                                                {employee.employeeCode}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm font-medium text-[#191c1e]">{employee.fullName}</td>
                                        {form.isProductionForm && (
                                            <>
                                                <td className="px-6 py-3 text-sm text-[#5e3f3a]">{employee.blockCodeSnapshot ?? "—"}</td>
                                                <td className="px-6 py-3 text-sm text-[#5e3f3a]">{employee.teamCodeSnapshot ?? "—"}</td>
                                                <td className="px-6 py-3 text-sm text-[#5e3f3a]">{employee.shiftTeamCodeSnapshot ?? "—"}</td>
                                            </>
                                        )}
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">
                                            {formatTime(employee.startTime)} — {formatTime(employee.endTime)}
                                        </td>
                                        <td className="px-6 py-3 text-center text-sm">
                                            <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                                {formatHours(hours)}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isMonthOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            {employee.monthToDate}h
                                        </td>
                                        <td className={`px-6 py-3 text-center text-sm ${isYearOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                            <span className="inline-flex items-center gap-1">
                                                {employee.yearToDate}h
                                                {canApprove && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setHistoryEmployee(employee)}
                                                        title={t("viewAccumulationHistoryHint")}
                                                        aria-label={t("viewAccumulationHistoryHint")}
                                                        className="cursor-pointer rounded-full p-0.5 text-[#8a8f94] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    >
                                                        <History className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-center text-sm">
                                            <MealTicketTypeBadge type={employee.mealTicketType} t={t} />
                                        </td>
                                        <td className="px-6 py-3 text-center text-sm">
                                            {employee.didEat ? (
                                                <span title={t("didEatYes")}>
                                                    <Check size={18} className="mx-auto text-emerald-600" aria-label={t("didEatYes")} role="img" />
                                                </span>
                                            ) : (
                                                <span title={t("didEatNoHint")}>
                                                    <X size={18} className="mx-auto text-[#9a5b00]" aria-label={t("didEatNo")} role="img" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">{bilingualText(employee.noteVn, employee.noteJp)}</td>
                                        {canRemoveEmployee && (
                                            <td className="px-6 py-3 text-right">
                                                {activeEmployees.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openRemove(employee)}
                                                        title={t("removeEmployeeButton")}
                                                        aria-label={t("removeEmployeeButton")}
                                                        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#e9bcb6] bg-white p-1.5 text-[#930006] transition hover:bg-[#fff4f2]"
                                                    >
                                                        <UserX className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("approvalHistoryTitle")}</h2>
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {form.approvalSteps.map((step) => {
                        const history = form.approvalHistories.find((item) => item.stepOrder === step.stepOrder);
                        return (
                            <div key={step.id} className="rounded-lg border border-[#e0e3e5] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {step.jobTitleNameSnapshot}
                                </div>
                                {history ? (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-sm font-semibold text-[#191c1e]">
                                            {history.approverFullName ?? history.approverUserName}
                                        </div>
                                        <div className="text-xs text-[#5e3f3a]">{approvalActionLabels[history.action]}</div>
                                        <div className="text-xs text-[#5e3f3a]">{formatDateTime(history.actionAt)}</div>
                                        {history.comment && <div className="text-xs text-[#191c1e]">&quot;{history.comment}&quot;</div>}
                                        {history.hasSignature && history.signatureImage && (
                                            // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, next/image không tối ưu được và cần width/height cố định trái với className fluid ở đây
                                            <img
                                                src={`data:image/png;base64,${history.signatureImage}`}
                                                alt={t("signatureAlt", { name: history.approverFullName ?? history.approverUserName })}
                                                className="h-16 w-full rounded border border-[#e0e3e5] object-contain"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs text-[#9aa0a6]">{t("notProcessedYet")}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("editLogTitle")}</h2>
                {form.editLogs.length === 0 ? (
                    <p className="text-sm text-[#9aa0a6]">{t("editLogEmpty")}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    <th className="px-4 py-2">{t("editLogColTime")}</th>
                                    <th className="px-4 py-2">{t("editLogColActor")}</th>
                                    <th className="px-4 py-2">{t("editLogColEmployee")}</th>
                                    <th className="px-4 py-2">{t("editLogColAction")}</th>
                                    <th className="px-4 py-2">{t("editLogColChange")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.editLogs.map((log, index) => (
                                    <tr key={index} className="border-b border-[#f1f5f9] text-sm">
                                        <td className="whitespace-nowrap px-4 py-2 text-[#5e3f3a]">{formatDateTime(log.actionAt)}</td>
                                        <td className="px-4 py-2 text-[#191c1e]">{log.actionByFullName ?? log.actionByUserName}</td>
                                        <td className="px-4 py-2 text-[#191c1e]">
                                            {log.employeeCodeSnapshot ?? "-"}
                                        </td>
                                        <td className="px-4 py-2 text-[#5e3f3a]">{editLogActionLabel(log)}</td>
                                        <td className="px-4 py-2 text-[#191c1e]">
                                            {log.oldValue != null || log.newValue != null
                                                ? t("editLogChangeValue", { oldValue: log.oldValue ?? "-", newValue: log.newValue ?? "-" })
                                                : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {showApprovalActions && (
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => openAction("reject")}
                        className="cursor-pointer rounded-lg border border-[#930006] bg-white px-4 py-2 text-sm font-semibold text-[#930006] transition hover:bg-[#fff4f2]"
                    >
                        {t("rejectButton")}
                    </button>
                    <button
                        onClick={() => openAction("approve")}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        {t("approveButton")}
                    </button>
                </div>
            )}

            {actionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeAction} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {actionOpen === "approve" ? t("modalTitleApprove") : t("modalTitleReject")}
                            </h3>
                            <button
                                onClick={closeAction}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("commentLabel")} {actionOpen === "reject" && <span className="text-[#930006]">*</span>}
                                </span>
                                <textarea
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    disabled={isSubmittingAction}
                                    rows={3}
                                    required={actionOpen === "reject"}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={secondaryPassword}
                                    onChange={(event) => setSecondaryPassword(event.target.value)}
                                    disabled={isSubmittingAction}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div
                                className={`rounded-lg border px-3 py-2 text-xs ${
                                    hasSecondaryPassword === false
                                        ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                        : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                }`}
                            >
                                {hasSecondaryPassword === false ? t("secondaryPasswordMissingHint") : t("secondaryPasswordOkHint")}
                            </div>

                            {actionOpen === "approve" && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-xs ${
                                        requireSignatureToApprove && hasMySignature === false
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`}
                                >
                                    {requireSignatureToApprove && hasMySignature === false
                                        ? t("approveSignatureMissingHint")
                                        : t("approveSignatureOkHint")}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeAction}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={actionOpen === "approve" ? handleApprove : handleReject}
                                    disabled={isSubmittingAction}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmittingAction
                                        ? tCommon("processing")
                                        : actionOpen === "approve"
                                        ? t("confirmApprove")
                                        : t("confirmReject")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {removeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeRemove} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("removeModalTitle", { name: removeTarget.fullName })}</h3>
                            <button
                                onClick={closeRemove}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-[#5e3f3a]">{t("removeModalDesc")}</p>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("removeReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={removeReason}
                                    onChange={(event) => setRemoveReason(event.target.value)}
                                    disabled={isRemovingEmployee}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={removeSecondaryPassword}
                                    onChange={(event) => setRemoveSecondaryPassword(event.target.value)}
                                    disabled={isRemovingEmployee}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>
                            {hasSecondaryPassword === false && (
                                <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-3 py-2 text-xs text-[#930006]">
                                    {t("secondaryPasswordMissingHint")}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeRemove}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemoveEmployee}
                                    disabled={isRemovingEmployee}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isRemovingEmployee ? tCommon("processing") : t("confirmRemove")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {addEmployeeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeAddEmployee} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("addEmployeeModalTitle")}</h3>
                            <button
                                onClick={closeAddEmployee}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {!addSelectedEmployee ? (
                                <>
                                    <div className="flex gap-2">
                                        <input
                                            value={addSearchKeyword}
                                            onChange={(event) => setAddSearchKeyword(event.target.value)}
                                            onKeyDown={(event) => event.key === "Enter" && handleSearchAddEmployee()}
                                            placeholder={t("addSearchPlaceholder")}
                                            className="h-10 flex-1 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchAddEmployee}
                                            disabled={isSearchingAddEmployee}
                                            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                                        >
                                            <Search className="h-3.5 w-3.5" /> {tCommon("search")}
                                        </button>
                                    </div>
                                    <div className="max-h-64 space-y-1 overflow-y-auto">
                                        {isSearchingAddEmployee ? (
                                            <p className="py-4 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</p>
                                        ) : addSearchResults.length === 0 ? (
                                            <p className="py-4 text-center text-sm text-[#9aa0a6]">{t("addSearchEmpty")}</p>
                                        ) : (
                                            addSearchResults.map((item) => (
                                                <button
                                                    key={item.employeeId}
                                                    type="button"
                                                    onClick={() => setAddSelectedEmployee(item)}
                                                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-left text-sm transition hover:border-[#e3000f] hover:bg-[#fff4f2]"
                                                >
                                                    <span className="font-medium text-[#191c1e]">{item.fullName}</span>
                                                    <span className="font-mono text-xs text-[#5e3f3a]">{item.employeeCode}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2">
                                        <div>
                                            <div className="text-sm font-semibold text-[#191c1e]">{addSelectedEmployee.fullName}</div>
                                            <div className="font-mono text-xs text-[#5e3f3a]">{addSelectedEmployee.employeeCode}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAddSelectedEmployee(null)}
                                            className="cursor-pointer text-xs font-semibold text-[#5e3f3a] underline transition hover:text-[#191c1e]"
                                        >
                                            {t("addChangeSelection")}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                {t("addEndTimeLabel")} <span className="text-[#930006]">*</span>
                                            </span>
                                            <input
                                                type="time"
                                                value={addEndTime}
                                                onChange={(event) => setAddEndTime(event.target.value)}
                                                disabled={isAddingEmployee}
                                                className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                            />
                                        </label>
                                        <label className="flex items-end pb-2.5">
                                            <span className="flex items-center gap-2 text-sm text-[#191c1e]">
                                                <input
                                                    type="checkbox"
                                                    checked={addDidEat}
                                                    onChange={(event) => setAddDidEat(event.target.checked)}
                                                    disabled={isAddingEmployee}
                                                    className="h-4 w-4 cursor-pointer rounded border-[#e0e3e5] text-[#e3000f] focus:ring-[#e3000f]"
                                                />
                                                {t("addDidEatLabel")}
                                            </span>
                                        </label>
                                    </div>

                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                            {t("colNote")}
                                        </span>
                                        <input
                                            value={addNoteVn}
                                            onChange={(event) => setAddNoteVn(event.target.value)}
                                            disabled={isAddingEmployee}
                                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                            {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                        </span>
                                        <input
                                            type="password"
                                            value={addSecondaryPassword}
                                            onChange={(event) => setAddSecondaryPassword(event.target.value)}
                                            disabled={isAddingEmployee}
                                            autoComplete="off"
                                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                        />
                                    </label>
                                    {hasSecondaryPassword === false && (
                                        <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-3 py-2 text-xs text-[#930006]">
                                            {t("secondaryPasswordMissingHint")}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={closeAddEmployee}
                                            disabled={isAddingEmployee}
                                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {tCommon("cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddEmployee}
                                            disabled={isAddingEmployee}
                                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isAddingEmployee ? tCommon("processing") : t("confirmAddEmployee")}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeDeleteModal} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">{t("deleteModalTitle", { id: form.id })}</h3>
                            <button
                                onClick={closeDeleteModal}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-[#5e3f3a]">{t("deleteModalDesc")}</p>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("deleteReasonLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <textarea
                                    value={deleteReason}
                                    onChange={(event) => setDeleteReason(event.target.value)}
                                    disabled={isDeletingForm}
                                    rows={3}
                                    required
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeDeleteModal}
                                    disabled={isDeletingForm}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteForm}
                                    disabled={isDeletingForm}
                                    className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isDeletingForm ? tCommon("processing") : t("confirmDelete")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {historyEmployee && (
                <AccumulationHistoryModal
                    employeeId={historyEmployee.employeeId}
                    employeeLabel={`${historyEmployee.fullName} (${historyEmployee.employeeCode})`}
                    onClose={() => setHistoryEmployee(null)}
                />
            )}
        </div>
    );
}
