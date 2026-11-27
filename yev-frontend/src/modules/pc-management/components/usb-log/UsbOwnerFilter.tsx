"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { StyledSelect } from "@/components/ui/StyledSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import { fieldClassName } from "@/components/ui/ListToolbar";

type Option = { value: number; label: string };

export type UsbOwnerOptions = { branches: Option[]; departments: Option[] };

// 0 = all.
export type UsbOwnerFilterValue = { branchId: number; departmentId: number };

// Workshops (asset Branches) and the company-wide department catalog.
export function useUsbOwnerOptions(): UsbOwnerOptions {
    const t = useTranslations("usbLog");
    const [options, setOptions] = useState<UsbOwnerOptions>({ branches: [], departments: [] });
    useFetchEffect(
        () => UsbLogApi.getOwnerOptions(),
        [],
        (result) =>
            setOptions({
                branches: result.branches.map((b) => ({ value: b.id, label: b.name })),
                departments: result.departments.map((d) => ({ value: d.id, label: d.name })),
            }),
        t("owner.loadError"),
        (message) => toast.error(message)
    );
    return options;
}

// No label row: the "all" option carries the field name, as in the other toolbar filters.
export function UsbOwnerFilterFields({
    options,
    value,
    onChange,
}: {
    options: UsbOwnerOptions;
    value: UsbOwnerFilterValue;
    onChange: (next: UsbOwnerFilterValue) => void;
}) {
    const t = useTranslations("usbLog");
    return (
        <>
            <div className="w-[calc(50%-0.25rem)] sm:w-36">
                <StyledSelect
                    value={value.branchId}
                    onChange={(branchId) => onChange({ ...value, branchId })}
                    options={[{ value: 0, label: t("common.allBranches") }, ...options.branches]}
                    ariaLabel={t("common.branch")}
                    triggerClassName={`${fieldClassName} w-full pr-8`}
                />
            </div>
            <div className="w-[calc(50%-0.25rem)] sm:w-36">
                <StyledSelect
                    value={value.departmentId}
                    onChange={(departmentId) => onChange({ ...value, departmentId })}
                    options={[{ value: 0, label: t("common.allDepartments") }, ...options.departments]}
                    ariaLabel={t("common.department")}
                    triggerClassName={`${fieldClassName} w-full pr-8`}
                />
            </div>
        </>
    );
}

// Workshop on top, department below; used by the USB, machine and agent tables.
export function UsbOwnerCell({ branchName, departmentName }: { branchName: string | null; departmentName: string | null }) {
    if (!branchName && !departmentName) return <span className="text-[#8a8f94]">-</span>;
    return (
        <>
            {branchName && <div className="whitespace-nowrap">{branchName}</div>}
            {departmentName && <div className="text-xs text-[#5e3f3a]">{departmentName}</div>}
        </>
    );
}
