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
  // Preview only, no DB writes; multipart field name is "file".
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Send the raw preview rows back; the server re-resolves ids against the current DB before writing.
  confirmImport: async (rows: DeviceImportRowDto[]) => {
    const response = await api.post<ApiResponse<DeviceImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_IMPORT.confirm,
      { rows }
    );
    return response.data;
  },
};

export { ENDPOINTS };
