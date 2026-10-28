import { useTranslations } from "next-intl";

// Locale-aware labels for the numeric Attendance enums (see types/enums.ts for the values and colours).
export function useEnumLabels() {
    const t = useTranslations("Attendance.Enums");

    const departmentManager = t("levelDepartmentManager");
    const workshopManager = t("levelWorkshopManager");
    const generalDirector = t("levelGeneralDirector");

    return {
        approvalLevel: {
            0: t("levelGroupLeader"),
            1: departmentManager,
            2: workshopManager,
            3: generalDirector,
            4: t("levelDepartmentHead"),
        } as Record<number, string>,
        terminalLevel: {
            0: t("levelNone"),
            1: departmentManager,
            2: workshopManager,
            3: generalDirector,
        } as Record<number, string>,
        otFormStatus: {
            0: t("statusPending"),
            1: t("statusCompleted"),
            2: t("statusRejected"),
        } as Record<number, string>,
        approvalAction: {
            0: t("actionSubmitted"),
            1: t("actionApproved"),
            2: t("actionRejected"),
        } as Record<number, string>,
    };
}
