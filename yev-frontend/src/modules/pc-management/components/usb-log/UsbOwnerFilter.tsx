"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { StyledSelect } from "@/components/ui/StyledSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";

type Option = { value: number; label: string };

export type UsbOwnerOptions = { branches: Option[]; departments: Option[] };

// 0 = all.
export type UsbOwnerFilterValue = { branchId: number; departmentId: number };

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

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
            <label className="block w-[calc(50%-0.25rem)] sm:w-40">
                <span className={fieldLabelClassName}>{t("common.branch")}</span>
                <StyledSelect
                    value={value.branchId}
                    onChange={(branchId) => onChange({ ...value, branchId })}
                    options={[{ value: 0, label: t("common.all") }, ...options.branches]}
                    triggerClassName={fieldClassName}
                />
            </label>
            <label className="block w-[calc(50%-0.25rem)] sm:w-40">
                <span className={fieldLabelClassName}>{t("common.department")}</span>
                <StyledSelect
                    value={value.departmentId}
                    onChange={(departmentId) => onChange({ ...value, departmentId })}
                    options={[{ value: 0, label: t("common.all") }, ...options.departments]}
                    triggerClassName={fieldClassName}
                />
            </label>
        </>
    );
}

// Workshop on top, department below; used by the USB, machine and agent tables.
export function UsbOwnerCell({ branchName, departmentName }: { branchName: string | null; departmentName: string | null }) {
    return (
        <>
            {branchName && <div className="whitespace-nowrap">{branchName}</div>}
            {departmentName && <div className="text-xs text-[#5e3f3a]">{departmentName}</div>}
        </>
    );
}
