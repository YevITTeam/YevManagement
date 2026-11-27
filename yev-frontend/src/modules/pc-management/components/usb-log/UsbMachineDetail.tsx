"use client";

import { useState } from "react";
import { ArrowLeft, History, Monitor, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbAgentEventDto } from "@/modules/pc-management/types/usb-log.dto";
import { Link, useRouter } from "@/navigation";
import { IconButton } from "./UsbListToolbar";
import UsbMachineUsbList from "./UsbMachineUsbList";
import { AGENT_EVENT_META, formatDateTime } from "./usb-log-format";

interface UsbMachineDetailProps {
    machineName: string;
    deviceId?: number;
    // Agent list row; without it the event log still shows but the PC can't be removed from the list.
    agentId?: number;
    // Tab the machine was opened from (?tab=), so Back returns there.
    backTab?: string;
}

const headerIconClassName = "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]";

export default function UsbMachineDetail({ machineName, deviceId, agentId, backTab }: UsbMachineDetailProps) {
    const t = useTranslations("usbLog");
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <Link href={{ pathname: "/pc/usb-log", query: backTab ? { tab: backTab } : {} }} prefetch={false} title={t("machineDetail.back")} aria-label={t("machineDetail.back")} className={headerIconClassName}>
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#5e3f3a]">{t("machineDetail.title")}</p>
                    <h1 className="break-all text-lg font-semibold leading-tight text-[#191c1e]">{machineName}</h1>
                </div>
                {deviceId && (
                    <Link
                        href={{ pathname: "/pc/devices", query: { id: String(deviceId) } }}
                        prefetch={false}
                        title={t("machineDetail.viewDevice")}
                        aria-label={t("machineDetail.viewDevice")}
                        className={headerIconClassName}
                    >
                        <Monitor className="h-4 w-4" />
                    </Link>
                )}
            </div>

            <UsbMachineUsbList machineName={machineName} deviceId={deviceId} />
            <UsbAgentLog machineName={machineName} agentId={agentId} />
        </div>
    );
}

// Agent lifecycle events of the PC (latest 100) and removal from the agent list.
function UsbAgentLog({ machineName, agentId }: { machineName: string; agentId?: number }) {
    const t = useTranslations("usbLog");
    const router = useRouter();
    const { user } = useAuth();
    const canEdit = hasPermission(user, "Asset.UsbLog.Approve");
    const [events, setEvents] = useState<UsbAgentEventDto[] | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);

    useFetchEffect(
        () => UsbLogApi.getAgentEvents(machineName),
        [machineName],
        setEvents,
        t("agents.eventsLoadError"),
        (message) => {
            setEvents([]);
            toast.error(message);
        }
    );

    const handleDelete = async () => {
        if (!agentId) return;
        setBusy(true);
        try {
            await UsbLogApi.deleteAgent(agentId);
            toast.success(t("agents.deleteSuccess"));
            router.push("/pc/usb-log");
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("agents.deleteFailed")));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e0e3e5] px-3 py-2">
                <History className="h-4 w-4 text-[#5e3f3a]" />
                <h2 className="flex-1 text-sm font-semibold text-[#191c1e]">{t("agents.logTitle")}</h2>
                {canEdit && agentId && (
                    <IconButton icon={Trash2} label={t("agents.removeMachineAria", { machine: machineName })} size="sm" variant="danger" onClick={() => setDeleting(true)} />
                )}
            </div>
            <div className="px-3 py-2">
                {events === null ? (
                    <Skeleton className="h-12 w-full max-w-xl" />
                ) : events.length === 0 ? (
                    <p className="py-1 text-sm text-[#8a8f94]">{t("agents.noEvents")}</p>
                ) : (
                    <ol className="divide-y divide-[#f1f5f9]">
                        {events.map((ev, index) => (
                            <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-sm">
                                <span className="w-32 shrink-0 whitespace-nowrap text-xs tabular-nums text-[#5e3f3a]">{formatDateTime(ev.occurredAt)}</span>
                                <span className="w-36 shrink-0">
                                    <Badge variant={AGENT_EVENT_META[ev.eventType]?.variant ?? "neutral"}>
                                        {AGENT_EVENT_META[ev.eventType] ? t(`agentEvent.${AGENT_EVENT_META[ev.eventType].key}`) : ev.eventType}
                                    </Badge>
                                </span>
                                {ev.detail && <span className="break-all text-[#191c1e]">{ev.detail}</span>}
                                {ev.actor && <span className="text-xs text-[#8a8f94]">{ev.actor}</span>}
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <ConfirmDialog
                isOpen={deleting}
                title={t("agents.deleteTitle")}
                message={t("agents.deleteMessage", { machine: machineName })}
                onApprove={handleDelete}
                onDenied={() => setDeleting(false)}
                approveLabel={t("common.delete")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />
        </section>
    );
}
