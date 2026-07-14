import { api } from "@/lib/client";
import type {
  DeviceImportRowDto,
  DeviceImportPreviewResultDto,
  DeviceImportConfirmResultDto,
} from "@/modules/pc-management/types/device-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  DEVICE_IMPORT: {
    preview: "/DeviceImport/preview",
    confirm: "/DeviceImport/confirm",
  },
} as const;

export const DeviceImportApi = {
  // multipart/form-data — field file tên "file". Chỉ đọc, không ghi DB.
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Gửi lại đúng mảng "rows" thô nhận từ preview — server tự tra lại Id theo DB hiện tại, ghi DB thật.
  confirmImport: async (rows: DeviceImportRowDto[]) => {
    const response = await api.post<ApiResponse<DeviceImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_IMPORT.confirm,
      { rows }
    );
    return response.data;
  },
};

export { ENDPOINTS };
