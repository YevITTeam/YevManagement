"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import AuditTrailList from "@/modules/pc-management/components/audit-trail/AuditTrailList";
import { AttendanceAuditTrailApi } from "@/modules/attendance/api/attendance-audit-trail.api";
import AttendanceMailLogList from "./AttendanceMailLogList";

type TabKey = "data" | "mail";

export default function AttendanceAuditTrailPage() {
    const [tab, setTab] = useState<TabKey>("data");
    const header = (
        <Tabs
            tabs={[
                { key: "data", label: "Thao tác dữ liệu" },
                { key: "mail", label: "Email" },
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
            tablePlaceholder="OtForm, Employee..."
            recordPlaceholder="Đơn #, mã NV..."
        />
    ) : (
        <AttendanceMailLogList header={header} />
    );
}
