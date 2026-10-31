import { api } from "@/lib/client";
import type {
  DeviceLiquidationImportRowDto,
  DeviceLiquidationImportPreviewResultDto,
  DeviceLiquidationImportConfirmResultDto,
} from "@/modules/pc-management/types/device-liquidation-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  DEVICE_LIQUIDATION_IMPORT: {
    preview: "/DeviceLiquidationImport/preview",
    confirm: "/DeviceLiquidationImport/confirm",
  },
} as const;

export const DeviceLiquidationImportApi = {
  // Preview only, no DB writes; multipart field name is "file".
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceLiquidationImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_LIQUIDATION_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Send the raw preview rows back; the server re-resolves everything before writing.
  confirmImport: async (rows: DeviceLiquidationImportRowDto[]) => {
    const response = await api.post<ApiResponse<DeviceLiquidationImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_LIQUIDATION_IMPORT.confirm,
      { rows }
    );
    return response.data;
  },
};

export { ENDPOINTS };
