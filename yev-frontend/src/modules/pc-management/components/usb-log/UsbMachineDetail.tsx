"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/navigation";
import UsbMachineUsbList from "./UsbMachineUsbList";

interface UsbMachineDetailProps {
    machineName: string;
    deviceId?: number;
}

export default function UsbMachineDetail({ machineName, deviceId }: UsbMachineDetailProps) {
    const t = useTranslations("usbLog");
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/pc/usb-log"
                        prefetch={false}
                        title={t("machineDetail.back")}
                        aria-label={t("machineDetail.back")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="text-lg font-semibold text-[#191c1e]">{t("machineDetail.title", { machine: machineName })}</h1>
                </div>
                {deviceId && (
                    <Link
                        href={{ pathname: "/pc/devices", query: { id: String(deviceId) } }}
                        prefetch={false}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                    >
                        {t("machineDetail.viewDevice")}
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                )}
            </div>

            <UsbMachineUsbList machineName={machineName} deviceId={deviceId} />
        </div>
    );
}
