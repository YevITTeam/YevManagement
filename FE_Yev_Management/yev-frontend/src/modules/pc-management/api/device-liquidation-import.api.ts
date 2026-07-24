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
  // multipart/form-data — field file tên "file". Chỉ đọc, không ghi DB.
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceLiquidationImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_LIQUIDATION_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Gửi lại đúng field thô của "rows" nhận từ preview — server tự resolve lại từ đầu, ghi DB thật.
  confirmImport: async (rows: DeviceLiquidationImportRowDto[]) => {
    const response = await api.post<ApiResponse<DeviceLiquidationImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_LIQUIDATION_IMPORT.confirm,
      { rows }
    );
    return response.data;
  },
};

export { ENDPOINTS };
