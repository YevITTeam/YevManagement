"use client";

import { useState } from "react";
import { OtOverviewApi } from "@/modules/attendance/api/ot-overview.api";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Whether the signed-in user may open the OT overview (Admin or Manager and above). Only asks the API when
// enabled, i.e. the user already holds Attendance.OTForm.Approve.
export function useOverviewAccess(enabled: boolean) {
    const [allowed, setAllowed] = useState(false);

    useFetchEffect(
        () => (enabled ? OtOverviewApi.getAccess() : Promise.resolve(false)),
        [enabled],
        setAllowed,
        ""
    );

    return allowed;
}
