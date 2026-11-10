import { toast } from "react-toastify";
import type { BadgeVariant } from "@/components/ui/Badge";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";

export const MAX_PAPER_SCAN_BYTES = 10 * 1024 * 1024;

export const PAPER_SCAN_BADGE: Record<number, BadgeVariant> = { 0: "warning", 1: "success", 2: "danger" };

// The tab is opened before the fetch: browsers block window.open once the click's user gesture has been awaited away.
export async function openPaperScan(formId: number, errorMessage: string) {
    const tab = window.open("", "_blank");
    try {
        const { blob } = await OtFormApi.getPaperScanFile(formId);
        if (tab) tab.location.href = URL.createObjectURL(blob);
    } catch (err) {
        console.error(err);
        tab?.close();
        toast.error(errorMessage);
    }
}
