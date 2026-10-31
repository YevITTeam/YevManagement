"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";

import { Link } from "@/navigation";
import UsbLogList from "./UsbLogList";

interface UsbMachineDetailProps {
    machineName: string;
    deviceId?: number;
}

// Newest sessions first.
export default function UsbMachineDetail({ machineName, deviceId }: UsbMachineDetailProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/pc/usb-log"
                        prefetch={false}
                        title="Quay lại"
                        aria-label="Quay lại"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="text-lg font-semibold text-[#191c1e]">USB của máy {machineName}</h1>
                </div>
                {deviceId && (
                    <Link
                        href={{ pathname: "/pc/devices", query: { id: String(deviceId) } }}
                        prefetch={false}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                    >
                        Xem thiết bị
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                )}
            </div>

            <UsbLogList machineName={machineName} />
        </div>
    );
}
