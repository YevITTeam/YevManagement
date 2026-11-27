import { api, getForBlob } from "@/lib/client";
import type {
    UsbAgentEventDto,
    UsbAgentPurgeRequest,
    UsbAgentReleaseDto,
    UsbAgentSettingDto,
    UsbAgentSettingRequest,
    UsbApprovalRequest,
    UsbMachineOptionDto,
    UsbOwnerOptionsDto,
    UsbDeviceDto,
    UsbFileEventDto,
    UsbFileSearchDto,
    UsbMachineDto,
    UsbMachineUsbDto,
    UsbPolicySettingDto,
    UsbSessionDto,
    UsbStatsDto,
} from "@/modules/pc-management/types/usb-log.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Reads need Asset.UsbLog.View; approve/revoke, machine-options and the block mode need Asset.UsbLog.Approve. The agent uses ingest/agent-sync.
const ENDPOINTS = {
    USB_LOG: {
        getMachines: "/UsbLog/machines",
        getSessions: "/UsbLog/sessions",
        searchFiles: "/UsbLog/files",
        getSessionFiles: (id: string) => `/UsbLog/sessions/${id}/files`,
        getMachineUsbs: "/UsbLog/machine-usbs",
        getDevices: "/UsbLog/devices",
        approve: (id: number) => `/UsbLog/devices/${id}/approve`,
        revoke: (id: number) => `/UsbLog/devices/${id}/revoke`,
        machine: (id: number, deviceId: number) => `/UsbLog/devices/${id}/machines/${deviceId}`,
        alias: (id: number) => `/UsbLog/devices/${id}/alias`,
        machineOptions: "/UsbLog/machine-options",
        ownerOptions: "/UsbLog/owner-options",
        policy: "/UsbLog/policy",
        agentEvents: (machineName: string) => `/UsbLog/agents/${encodeURIComponent(machineName)}/events`,
        agent: (id: number) => `/UsbLog/agents/${id}`,
        purgeAgents: "/UsbLog/agents/purge",
        stats: "/UsbLog/stats",
        agentSettings: "/UsbLog/agent-settings",
        uninstallPassword: "/UsbLog/agent-settings/uninstall-password",
        releases: "/UsbLog/agent-releases",
        release: (id: number) => `/UsbLog/agent-releases/${id}`,
        exportDevices: "/UsbLog/devices/export",
        exportSessions: "/UsbLog/sessions/export",
        exportFiles: "/UsbLog/files/export",
        exportMachines: "/UsbLog/machines/export",
    },
} as const;

export interface GetUsbDevicesParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    isApproved?: boolean;
    deviceClass?: string;
    branchId?: number;
    departmentId?: number;
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
    sensitiveOnly?: boolean;
    branchId?: number;
    departmentId?: number;
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
    sensitiveOnly?: boolean;
    staleOnly?: boolean;
    branchId?: number;
    departmentId?: number;
    sortBy?: string;
    sortDesc?: boolean;
}

export interface SearchUsbFilesParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    extension?: string;
    fromDate?: string;
    toDate?: string;
    // "out" = written to the USB, "in" = copied onto the PC, "deleted".
    direction?: string;
    sensitiveOnly?: boolean;
    branchId?: number;
    departmentId?: number;
    sortBy?: string;
    sortDesc?: boolean;
}

export const UsbLogApi = {
    getMachines: async (params: GetUsbMachinesParams = {}) => {
        const response = await api.get<ApiResponseWithPageNation<UsbMachineDto>>(withQuery(ENDPOINTS.USB_LOG.getMachines, { ...params }));
        return response.data;
    },
    getSessions: async (params: GetUsbSessionsParams = {}) => {
        const response = await api.get<ApiResponseWithPageNation<UsbSessionDto>>(withQuery(ENDPOINTS.USB_LOG.getSessions, { ...params }));
        return response.data;
    },
    searchFiles: async (params: SearchUsbFilesParams = {}) => {
        const response = await api.get<ApiResponseWithPageNation<UsbFileSearchDto>>(withQuery(ENDPOINTS.USB_LOG.searchFiles, { ...params }));
        return response.data;
    },
    getSessionFiles: async (
        id: string,
        params: { pageIndex?: number; pageSize?: number; sortBy?: string; sortDesc?: boolean; sensitiveOnly?: boolean } = {}
    ) => {
        const response = await api.get<ApiResponseWithPageNation<UsbFileEventDto>>(withQuery(ENDPOINTS.USB_LOG.getSessionFiles(id), { ...params }));
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
    getOwnerOptions: async () => {
        const response = await api.get<ApiResponse<UsbOwnerOptionsDto>>(ENDPOINTS.USB_LOG.ownerOptions);
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
    getAgentEvents: async (machineName: string) => {
        const response = await api.get<ApiResponse<UsbAgentEventDto[]>>(ENDPOINTS.USB_LOG.agentEvents(machineName));
        return response.data;
    },
    deleteAgent: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.USB_LOG.agent(id));
        return response.data;
    },
    purgeAgents: async (body: UsbAgentPurgeRequest) => {
        const response = await api.post<ApiResponse<number>>(ENDPOINTS.USB_LOG.purgeAgents, body);
        return response.data;
    },
    getStats: async () => {
        const response = await api.get<ApiResponse<UsbStatsDto>>(ENDPOINTS.USB_LOG.stats);
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
    exportSessions: (params: GetUsbSessionsParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportSessions, { ...params })),
    exportFiles: (params: SearchUsbFilesParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportFiles, { ...params })),
    exportMachines: (params: GetUsbMachinesParams) => getForBlob(withQuery(ENDPOINTS.USB_LOG.exportMachines, { ...params })),
};

export { ENDPOINTS };
