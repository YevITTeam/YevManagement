import { api } from "@/lib/client";
import type { CreateTransferHistoryDto, TransferHistoryDto } from "@/modules/pc-management/types/transfer-history.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    TRANSFER_HISTORY: {
        createTransfer: "/TransferHistory",
        getTransferHistoryByDevice: (deviceId: number) => `/TransferHistory/device/${deviceId}`,
    }
} as const;

export const TransferHistoryApi = {
    createTransfer: async (data: CreateTransferHistoryDto) => {
        const response = await api.post<ApiResponse<TransferHistoryDto>>(ENDPOINTS.TRANSFER_HISTORY.createTransfer, data);
        return response.data;
    },
    getTransferHistoryByDevice: async (deviceId: number) => {
        const response = await api.get<ApiResponse<TransferHistoryDto[]>>(
            ENDPOINTS.TRANSFER_HISTORY.getTransferHistoryByDevice(deviceId)
        );
        return response.data;
    },
};

export { ENDPOINTS as TRANSFER_HISTORY_ENDPOINTS };
