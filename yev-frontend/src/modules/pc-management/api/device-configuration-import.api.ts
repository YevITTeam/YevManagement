import { api, postFormForBlob } from "@/lib/client";
import type {
  DeviceConfigurationImportRowDto,
  DeviceConfigurationImportPreviewResultDto,
  DeviceConfigurationImportConfirmResultDto,
  MissingDevicesReportResultDto,
  DeviceMissingInTaniumDto,
} from "@/modules/pc-management/types/device-configuration-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  DEVICE_CONFIGURATION_IMPORT: {
    preview: "/DeviceConfigurationImport/preview",
    confirm: "/DeviceConfigurationImport/confirm",
    missingDevicesReport: "/DeviceConfigurationImport/missing-devices-report",
    missingDevices: "/DeviceConfigurationImport/missing-devices",
  },
} as const;

export const DeviceConfigurationImportApi = {
  // Preview only, no DB writes; multipart field name is "file".
  previewImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.postForm<ApiResponse<DeviceConfigurationImportPreviewResultDto>>(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.preview,
      formData
    );
    return response.data;
  },

  // Send the raw preview rows back; the server re-resolves everything before writing. createMissingUsers adds
  // Basic-role Identity users for AD accounts; overwriteExistingAccount replaces the device's domain account with Tanium's.
  confirmImport: async (
    rows: DeviceConfigurationImportRowDto[],
    createMissingUsers: boolean,
    overwriteExistingAccount: boolean
  ) => {
    const response = await api.post<ApiResponse<DeviceConfigurationImportConfirmResultDto>>(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.confirm,
      { rows, createMissingUsers, overwriteExistingAccount }
    );
    return response.data;
  },

  // In-use Devices missing from the Tanium file; read-only and independent of preview.
  getMissingDevices: async (file: File, deviceCodePrefixes: string[]) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prefixes", deviceCodePrefixes.join(","));

    const response = await api.postForm<ApiResponse<DeviceMissingInTaniumDto[]>>(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.missingDevices,
      formData
    );
    return response.data;
  },

  // Same report as .xlsx (BE re-reads the file; counts come from response headers).
  // deviceCodePrefixes (e.g. ["YDC","YDF"]) limit which devices are compared.
  exportMissingDevicesReport: async (
    file: File,
    deviceCodePrefixes: string[]
  ): Promise<MissingDevicesReportResultDto> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prefixes", deviceCodePrefixes.join(","));

    const { blob, fileName, headers } = await postFormForBlob(
      ENDPOINTS.DEVICE_CONFIGURATION_IMPORT.missingDevicesReport,
      formData
    );

    return {
      blob,
      fileName: fileName ?? "BaoCaoDoiChieuTanium.xlsx",
      missingCount: Number(headers.get("x-missing-device-count") ?? "0"),
    };
  },
};

export { ENDPOINTS };
