import { api } from "@/lib/client";
import type {
  DeviceConfigurationImportRowDto,
  DeviceConfigurationImportPreviewResultDto,
  DeviceConfigurationImportConfirmResultDto,
} from "@/modules/pc-management/types/device-configuration-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  DEVICE_CONFIGURATION_IMPORT: {
    preview: "/DeviceConfigurationImport/preview",
    confirm: "/DeviceConfigurationImport/confirm",
  },
} as const;

export const DeviceConfigurationImportApi = {
  // multipart/form-data — field file tên "file". Chỉ đọc, không ghi DB.
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceConfigurationImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Gửi lại đúng field thô của "rows" nhận từ preview — server tự resolve lại từ đầu, ghi DB thật.
  confirmImport: async (rows: DeviceConfigurationImportRowDto[]) => {
    const response = await api.post<ApiResponse<DeviceConfigurationImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.confirm,
      { rows }
    );
    return response.data;
  },
};

export { ENDPOINTS };
