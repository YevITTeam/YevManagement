"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui/Tabs";
import AuditTrailList from "@/modules/pc-management/components/audit-trail/AuditTrailList";
import { AttendanceAuditTrailApi } from "@/modules/attendance/api/attendance-audit-trail.api";
import AttendanceMailLogList from "./AttendanceMailLogList";

type TabKey = "data" | "mail";

export default function AttendanceAuditTrailPage() {
    const t = useTranslations("Attendance.AuditTrail");
    const [tab, setTab] = useState<TabKey>("data");
    const header = (
        <Tabs
            tabs={[
                { key: "data", label: t("tabData") },
                { key: "mail", label: t("tabMail") },
            ]}
            activeKey={tab}
            onChange={setTab}
        />
    );

    return tab === "data" ? (
        <AuditTrailList
            fetchPage={AttendanceAuditTrailApi.getAuditTrailPageNation}
            cacheKey="attendance-audit-trail"
            header={header}
            tablePlaceholder={t("tablePlaceholder")}
            recordPlaceholder={t("recordPlaceholder")}
        />
    ) : (
        <AttendanceMailLogList header={header} />
    );
}
