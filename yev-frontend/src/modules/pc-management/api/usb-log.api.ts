import { api, getForBlob } from "@/lib/client";
import type {
    UsbAgentDto,
    UsbAgentEventDto,
    UsbAgentReleaseDto,
    UsbAgentSettingDto,
    UsbAgentSettingRequest,
    UsbApprovalRequest,
    UsbMachineOptionDto,
    UsbDeviceDto,
    UsbFileEventDto,
    UsbMachineDto,
    UsbMachineUsbDto,
    UsbPolicySettingDto,
    UsbSessionDto,
} from "@/modules/pc-management/types/usb-log.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Reads need Asset.UsbLog.View; approve/revoke, machine-options and the block mode need Asset.UsbLog.Approve. The agent uses ingest/agent-sync.
const ENDPOINTS = {
    USB_LOG: {
        getMachines: "/UsbLog/machines",
        getSessions: "/UsbLog/sessions",
        getSessionFiles: (id: string) => `/UsbLog/sessions/${id}/files`,
        getMachineUsbs: "/UsbLog/machine-usbs",
        getDevices: "/UsbLog/devices",
        approve: (id: number) => `/UsbLog/devices/${id}/approve`,
        revoke: (id: number) => `/UsbLog/devices/${id}/revoke`,
        machine: (id: number, deviceId: number) => `/UsbLog/devices/${id}/machines/${deviceId}`,
        alias: (id: number) => `/UsbLog/devices/${id}/alias`,
        machineOptions: "/UsbLog/machine-options",
        policy: "/UsbLog/policy",
        getAgents: "/UsbLog/agents",
        agentEvents: (machineName: string) => `/UsbLog/agents/${encodeURIComponent(machineName)}/events`,
        agentSettings: "/UsbLog/agent-settings",
        uninstallPassword: "/UsbLog/agent-settings/uninstall-password",
        releases: "/UsbLog/agent-releases",
        release: (id: number) => `/UsbLog/agent-releases/${id}`,
        exportDevices: "/UsbLog/devices/export",
        exportSessions: "/UsbLog/sessions/export",
        exportFiles: "/UsbLog/files/export",
    },
} as const;

export interface GetUsbDevicesParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    isApproved?: boolean;
    deviceClass?: string;
    sortBy?: string;
    sortDesc?: boolean;
}

export interface GetUsbAgentsParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    staleOnly?: boolean;
    sortBy?: string;
    sortDesc?: boolean;
}

function withQuery(base: string, params: Record<string, string | number | boolean | undefined>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
    }
    const queryString = query.toString();
    return queryString ? `${base}?${queryString}` : base;
}

export interface GetUsbSessionsParams {
    pageIndex?: number;
    pageSize?: number;
    deviceId?: number;
    machineName?: string;
    usbDeviceId?: number;
    keyword?: string;
    fromDate?: string;
    toDate?: string;
    unpermittedOnly?: boolean;
    sortBy?: string;
    sortDesc?: boolean;
}

export interface GetUsbMachinesParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    fromDate?: string;
    toDate?: string;
    connectedNowOnly?: boolean;
    sortBy?: string;
    sortDesc?: boolean;
}

export const UsbLogApi = {
    getMachines: async (params?: GetUsbMachinesParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.keyword) query.set("keyword", params.keyword);
        if (params?.fromDate) query.set("fromDate", params.fromDate);
        if (params?.toDate) query.set("toDate", params.toDate);
        if (params?.connectedNowOnly) query.set("connectedNowOnly", "true");
        if (params?.sortBy) query.set("sortBy", params.sortBy);
        if (params?.sortDesc) query.set("sortDesc", "true");
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.USB_LOG.getMachines}?${queryString}` : ENDPOINTS.USB_LOG.getMachines;
        const response = await api.get<ApiResponseWithPageNation<UsbMachineDto>>(url);
        return response.data;
    },
    getSessions: async (params?: GetUsbSessionsParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.deviceId !== undefined) query.set("deviceId", String(params.deviceId));
        if (params?.machineName) query.set("machineName", params.machineName);
        if (params?.usbDeviceId !== undefined) query.set("usbDeviceId", String(params.usbDeviceId));
        if (params?.keyword) query.set("keyword", params.keyword);
        if (params?.fromDate) query.set("fromDate", params.fromDate);
        if (params?.toDate) query.set("toDate", params.toDate);
        if (params?.unpermittedOnly) query.set("unpermittedOnly", "true");
        if (params?.sortBy) query.set("sortBy", params.sortBy);
        if (params?.sortDesc) query.set("sortDesc", "true");
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.USB_LOG.getSessions}?${queryString}` : ENDPOINTS.USB_LOG.getSessions;
        const response = await api.get<ApiResponseWithPageNation<UsbSessionDto>>(url);
        return response.data;
    },
    getSessionFiles: async (id: string, params?: { pageIndex?: number; pageSize?: number; sortBy?: string; sortDesc?: boolean }) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.sortBy) query.set("sortBy", params.sortBy);
        if (params?.sortDesc) query.set("sortDesc", "true");
        const queryString = query.toString();
        const base = ENDPOINTS.USB_LOG.getSessionFiles(id);
        const response = await api.get<ApiResponseWithPageNation<UsbFileEventDto>>(queryString ? `${base}?${queryString}` : base);
        return response.data;
    },
    getMachineUsbs: async (machineName: string) => {
        const response = await api.get<ApiResponse<UsbMachineUsbDto[]>>(withQuery(ENDPOINTS.USB_LOG.getMachineUsbs, { machineName }));
        return response.data;
    },
    getDevices: async (params: GetUsbDevicesParams) => {
        const response = await api.get<ApiResponseWithPageNation<UsbDeviceDto>>(withQuery(ENDPOINTS.USB_LOG.getDevices, { ...params }));
        return response.data;
    },
    approve: async (id: number, body: UsbApprovalRequest) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.approve(id), body);
        return response.data;
    },
    setAlias: async (id: number, alias: string) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.alias(id), { alias: alias || null });
        return response.data;
    },
    approveMachine: async (id: number, deviceId: number) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.machine(id, deviceId));
        return response.data;
    },
    revokeMachine: async (id: number, deviceId: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.machine(id, deviceId));
        return response.data;
    },
    getMachineOptions: async () => {
        const response = await api.get<ApiResponse<UsbMachineOptionDto[]>>(ENDPOINTS.USB_LOG.machineOptions);
        return response.data;
    },
    revoke: async (id: number) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.revoke(id));
        return response.data;
    },
    getPolicy: async () => {
        const response = await api.get<ApiResponse<UsbPolicySettingDto>>(ENDPOINTS.USB_LOG.policy);
        return response.data;
    },
    updatePolicy: async (body: UsbPolicySettingDto) => {
        const response = await api.put<ApiResponse<UsbPolicySettingDto>>(ENDPOINTS.USB_LOG.policy, body);
        return response.data;
    },
    getAgents: async (params: GetUsbAgentsParams) => {
        const response = await api.get<ApiResponseWithPageNation<UsbAgentDto>>(withQuery(ENDPOINTS.USB_LOG.getAgents, { ...params }));
        return response.data;
    },
    getAgentEvents: async (machineName: string) => {
        const response = await api.get<ApiResponse<UsbAgentEventDto[]>>(ENDPOINTS.USB_LOG.agentEvents(machineName));
        return response.data;
    },
    getAgentSetting: async () => {
        const response = await api.get<ApiResponse<UsbAgentSettingDto>>(ENDPOINTS.USB_LOG.agentSettings);
        return response.data;
    },
    updateAgentSetting: async (body: UsbAgentSettingRequest) => {
        const response = await api.put<ApiResponse<UsbAgentSettingDto>>(ENDPOINTS.USB_LOG.agentSettings, body);
        return response.data;
    },
    // Empty password removes it.
    setUninstallPassword: async (password: string) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.uninstallPassword, { password: password || null });
        return response.data;
    },
    getReleases: async () => {
        const response = await api.get<ApiResponse<UsbAgentReleaseDto[]>>(ENDPOINTS.USB_LOG.releases);
        return response.data;
    },
    // The BE signs the exe with its release key; the version comes from the exe's file version.
    uploadRelease: async (file: File, note: string) => {
        const formData = new FormData();
        formData.append("file", file);
        if (note) formData.append("note", note);
        const response = await api.postForm<ApiResponse<UsbAgentReleaseDto>>(ENDPOINTS.USB_LOG.releases, formData);
        return response.data;
    },
    deleteRelease: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.release(id));
        return response.data;
    },
    exportDevices: (params: GetUsbDevicesParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportDevices, { ...params })),
    // Same filter as the session list; files = file operations of those sessions.
    exportSessions: (params: GetUsbSessionsParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportSessions, { ...params })),
    exportFiles: (params: GetUsbSessionsParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportFiles, { ...params })),
};

export { ENDPOINTS };
