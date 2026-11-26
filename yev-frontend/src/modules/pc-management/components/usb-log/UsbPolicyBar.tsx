"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { StyledSelect } from "@/components/ui/StyledSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbPolicySettingDto } from "@/modules/pc-management/types/usb-log.dto";

const fieldClassName =
    "h-9 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:bg-[#f8fafc]";

const MODE_OPTIONS = [
    { value: 0, key: "off", dotClassName: "bg-[#8a8f94]" },
    { value: 1, key: "audit", dotClassName: "bg-[#9a5b00]" },
    { value: 2, key: "enforce", dotClassName: "bg-[#e3000f]" },
];

// Block mode of the whole fleet; Enforce applies only to the listed machines (empty = every machine), the rest run as Audit.
export default function UsbPolicyBar({ canEdit }: { canEdit: boolean }) {
    const t = useTranslations("usbLog");
    const [saved, setSaved] = useState<UsbPolicySettingDto | null>(null);
    const [mode, setMode] = useState(0);
    const [machines, setMachines] = useState("");
    const [saving, setSaving] = useState(false);

    useFetchEffect(
        () => UsbLogApi.getPolicy(),
        [],
        (result) => {
            setSaved(result);
            setMode(result.mode);
            setMachines(result.enforceMachines ?? "");
        },
        t("policyBar.loadError"),
        (message) => toast.error(message)
    );

    const dirty = saved !== null && (mode !== saved.mode || machines.trim() !== (saved.enforceMachines ?? ""));

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await UsbLogApi.updatePolicy({ mode, enforceMachines: machines.trim() || null });
            setSaved(result);
            setMachines(result.enforceMachines ?? "");
            toast.success(t("policyBar.saveSuccess"));
        } catch (error) {
            console.error(error);
            toast.error(t("policyBar.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
            <span className="text-sm font-semibold text-[#191c1e]" title={t("policyBar.modeTitle")}>
                {t("policyBar.label")}
            </span>
            <div className="w-28">
                <StyledSelect
                    value={mode}
                    onChange={setMode}
                    options={MODE_OPTIONS.map(({ key, ...option }) => ({ ...option, label: t(`policyBar.modes.${key}`) }))}
                    disabled={!canEdit || saved === null}
                    ariaLabel={t("policyBar.modeAria")}
                    triggerClassName={`${fieldClassName} w-full pr-8`}
                />
            </div>
            {mode === 2 && (
                <input
                    value={machines}
                    onChange={(event) => setMachines(event.target.value)}
                    disabled={!canEdit}
                    placeholder={t("policyBar.machinesPlaceholder")}
                    title={t("policyBar.machinesTitle")}
                    aria-label={t("policyBar.machinesAria")}
                    className={`${fieldClassName} w-full sm:w-96`}
                />
            )}
            {canEdit && dirty && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#e3000f] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("common.save")}
                </button>
            )}
        </section>
    );
}
