"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import InfoTooltip from "@/components/ui/InfoTooltip";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbPolicySettingDto } from "@/modules/pc-management/types/usb-log.dto";
import { fieldClassName } from "./UsbListToolbar";

const MODES = [
    { value: 0, key: "off", activeClassName: "text-[#191c1e]" },
    { value: 1, key: "audit", activeClassName: "text-[#9a5b00]" },
    { value: 2, key: "enforce", activeClassName: "text-[#e3000f]" },
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
    const locked = !canEdit || saved === null;

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
        <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#e0e3e5] bg-white px-3 py-2 shadow-sm">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#191c1e]">
                <Shield className="h-4 w-4 text-[#5e3f3a]" />
                {t("policyBar.label")}
                <InfoTooltip text={t("policyBar.modeTitle")} />
            </span>
            <div role="radiogroup" aria-label={t("policyBar.modeAria")} className="inline-flex rounded-lg border border-[#e0e3e5] bg-[#f2f4f6] p-0.5">
                {MODES.map((option) => {
                    const active = mode === option.value;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={locked}
                            onClick={() => setMode(option.value)}
                            className={`cursor-pointer rounded-md px-3 py-1 text-sm font-semibold transition disabled:cursor-not-allowed ${
                                active ? `bg-white shadow-sm ${option.activeClassName}` : "text-[#5e3f3a] hover:text-[#191c1e] disabled:hover:text-[#5e3f3a]"
                            }`}
                        >
                            {t(`policyBar.modes.${option.key}`)}
                        </button>
                    );
                })}
            </div>
            {mode === 2 && (
                <input
                    value={machines}
                    onChange={(event) => setMachines(event.target.value)}
                    disabled={!canEdit}
                    placeholder={t("policyBar.machinesPlaceholder")}
                    title={t("policyBar.machinesTitle")}
                    aria-label={t("policyBar.machinesAria")}
                    className={`${fieldClassName} w-full sm:w-80`}
                />
            )}
            {canEdit && dirty && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex h-9 cursor-pointer items-center whitespace-nowrap rounded-lg bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("common.save")}
                </button>
            )}
        </section>
    );
}
