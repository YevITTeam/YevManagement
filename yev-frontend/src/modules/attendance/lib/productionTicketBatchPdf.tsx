"use client";

import JSZip from "jszip";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import { AttendanceSettingApi } from "@/modules/attendance/api/attendance-setting.api";
import type { OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import type { ProductionTicketBatchGroupDto } from "@/modules/attendance/types/production-ot-report.dto";
import { renderOtFormPages } from "@/modules/attendance/lib/otFormPrintTemplate";
import { renderPagesToPdfBlob } from "@/modules/attendance/lib/otFormPdf";

// Bulk YEV-22-024 export: same HTML template as the single-form print, turned into one PDF per group.

function sanitizeFileNamePart(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

// /ticket-batch returns only printed fields; fill the rest of OtFormEmployeeDto with safe defaults for typing.
function toPrintableEmployee(e: ProductionTicketBatchGroupDto["employees"][number]): OtFormDto["employees"][number] {
    return {
        employeeId: e.employeeId,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        startTime: e.startTime,
        endTime: e.endTime,
        noteVn: e.noteVn,
        noteJp: null,
        monthToDate: e.monthToDate,
        yearToDate: e.yearToDate,
        customMonthlyOtHourLimit: null,
        customYearlyOtHourLimit: null,
        mealTicketType: 0,
        actualHours: 0,
        didEat: false,
        isRemoved: false,
        removedByUserName: null,
        removedByFullName: null,
        removedAtLevel: null,
        removedAt: null,
        removeReason: null,
        congDoanSnapshot: e.congDoanSnapshot,
        taskNameSnapshot: e.taskNameSnapshot,
        blockCodeSnapshot: e.blockCodeSnapshot,
        teamCodeSnapshot: e.teamCodeSnapshot,
        shiftTeamCodeSnapshot: e.shiftTeamCodeSnapshot,
    };
}

export interface BuildTicketZipResult {
    blob: Blob;
    fileName: string;
}

// dateIso: "yyyy-MM-dd". Returns null when there are no groups so the caller can toast instead of producing an empty zip.
export async function buildProductionTicketZip(
    groups: ProductionTicketBatchGroupDto[],
    dateIso: string,
    onProgress?: (done: number, total: number) => void
): Promise<BuildTicketZipResult | null> {
    if (groups.length === 0) return null;

    // Groups often share a primary form, so fetch each form once and all in parallel.
    const formIds = Array.from(new Set(groups.map((g) => g.primaryOtFormId)));
    const [settings, forms] = await Promise.all([
        AttendanceSettingApi.getSetting(),
        Promise.all(formIds.map((formId) => OtFormApi.getOtFormById(formId))),
    ]);
    const formById = new Map(forms.map((f) => [f.id, f]));

    const zip = new JSZip();
    const [year, month, day] = dateIso.split("-");
    const ddMMyyyy = `${day}-${month}-${year}`;

    for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        const form: OtFormDto = {
            ...formById.get(group.primaryOtFormId)!,
            employees: group.employees.map(toPrintableEmployee),
            numberOfEmployee: group.employeeCount,
        };
        const pdfBlob = await renderPagesToPdfBlob(renderOtFormPages(form, "a4", settings), "a4");
        const fileName = `${group.employeeCount}-SAN XUAT TANG CA ${sanitizeFileNamePart(group.block)}-${sanitizeFileNamePart(group.shiftTeam)} ngay ${ddMMyyyy}.pdf`;
        zip.file(fileName, pdfBlob);
        onProgress?.(g + 1, groups.length);
        // Let React paint the progress between CPU-heavy PDFs.
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    return { blob: zipBlob, fileName: `Phieu_TangCa_${ddMMyyyy}.zip` };
}
