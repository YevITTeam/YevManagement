import { api } from "@/lib/client";
import type {
    IpAddressBulkStatusDto,
    IpAddressBulkStatusResultDto,
    IpAddressUpdateDto,
    IpAddressDto,
    IpPrefixCreateDto,
    IpPrefixDto,
    IpPrefixUpdateDto,
} from "@/modules/pc-management/types/ip.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    IP_ADDRESS: {
        getIpAddressPageNation: "/IpAddress/grid-list",
        getAvailableIpAddress: "/IpAddress/available",
        getIpAddressById: (id: number) => `/IpAddress/${id}`,
        updateIpAddress: (id: number) => `/IpAddress/${id}`,
        updateIpAddressBulkStatus: "/IpAddress/bulk-status",
        assignIpAddress: (id: number) => `/IpAddress/${id}/assign`,
        unassignIpAddress: (id: number) => `/IpAddress/${id}/unassign`,
    },
    IP_PREFIX: {
        getIpPrefixPageNation: "/IpPrefix/grid-list",
        getAllIpPrefix: "/IpPrefix/all",
        getIpPrefixById: (id: number) => `/IpPrefix/${id}`,
        createIpPrefix: "/IpPrefix",
        updateIpPrefix: (id: number) => `/IpPrefix/${id}`,
        deleteIpPrefix: (id: number) => `/IpPrefix/${id}`,
    }
} as const;

export interface GetIpAddressPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    status?: number;
    isInUse?: boolean;
    deviceId?: number;
}

export interface GetIpPrefixPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const IpApi = {
    // IpAddresses are only created/removed via IpPrefix (no manual POST/DELETE).
    getIpAddressPageNation: async (params?: GetIpAddressPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.status !== undefined) query.set("Status", String(params.status));
        if (params?.isInUse !== undefined) query.set("IsInUse", String(params.isInUse));
        if (params?.deviceId !== undefined) query.set("DeviceId", String(params.deviceId));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.IP_ADDRESS.getIpAddressPageNation}?${queryString}` : ENDPOINTS.IP_ADDRESS.getIpAddressPageNation;
        const response = await api.get<ApiResponseWithPageNation<IpAddressDto>>(url);
        return response.data;
    },
    getAvailableIpAddress: async (keyword?: string) => {
        const query = new URLSearchParams();
        if (keyword) query.set("Keyword", keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.IP_ADDRESS.getAvailableIpAddress}?${queryString}` : ENDPOINTS.IP_ADDRESS.getAvailableIpAddress;
        const response = await api.get<ApiResponse<IpAddressDto[]>>(url);
        return response.data;
    },
    getIpAddressById: async (id: number) => {
        const response = await api.get<ApiResponse<IpAddressDto>>(ENDPOINTS.IP_ADDRESS.getIpAddressById(id));
        return response.data;
    },
    // PUT only changes status + note.
    updateIpAddress: async (id: number, data: IpAddressUpdateDto) => {
        const response = await api.put<ApiResponse<IpAddressDto>>(ENDPOINTS.IP_ADDRESS.updateIpAddress(id), {
            id,
            ...data
        });
        return response.data;
    },
    // Bulk status (0/1 only) with partial success; returns the full envelope since the toast uses the server message.
    updateIpAddressBulkStatus: async (data: IpAddressBulkStatusDto) => {
        return api.put<ApiResponse<IpAddressBulkStatusResultDto>>(
            ENDPOINTS.IP_ADDRESS.updateIpAddressBulkStatus,
            data
        );
    },
    assignIpAddress: async (id: number, deviceId: number) => {
        const response = await api.put<ApiResponse<IpAddressDto>>(ENDPOINTS.IP_ADDRESS.assignIpAddress(id), { deviceId });
        return response.data;
    },
    unassignIpAddress: async (id: number) => {
        const response = await api.put<ApiResponse<IpAddressDto>>(ENDPOINTS.IP_ADDRESS.unassignIpAddress(id));
        return response.data;
    },
    getIpPrefixPageNation: async (params?: GetIpPrefixPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.IP_PREFIX.getIpPrefixPageNation}?${queryString}` : ENDPOINTS.IP_PREFIX.getIpPrefixPageNation;
        const response = await api.get<ApiResponseWithPageNation<IpPrefixDto>>(url);
        return response.data;
    },
    getAllIpPrefix: async () => {
        const response = await api.get<ApiResponse<IpPrefixDto[]>>(ENDPOINTS.IP_PREFIX.getAllIpPrefix);
        return response.data;
    },
    getIpPrefixById: async (id: number) => {
        const response = await api.get<ApiResponse<IpPrefixDto>>(ENDPOINTS.IP_PREFIX.getIpPrefixById(id));
        return response.data;
    },
    // Generates 254 child IpAddresses (.1-.254).
    createIpPrefix: async (ipPrefixData: IpPrefixCreateDto) => {
        const response = await api.post<ApiResponse<IpPrefixDto>>(ENDPOINTS.IP_PREFIX.createIpPrefix, ipPrefixData);
        return response.data;
    },
    // Branch and network config are editable; the prefix itself is not.
    updateIpPrefix: async (id: number, ipPrefixData: IpPrefixUpdateDto) => {
        const response = await api.put<ApiResponse<IpPrefixDto>>(ENDPOINTS.IP_PREFIX.updateIpPrefix(id), {
            id,
            ...ipPrefixData,
        });
        return response.data;
    },
    deleteIpPrefix: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.IP_PREFIX.deleteIpPrefix(id));
        return response.data;
    },
}
