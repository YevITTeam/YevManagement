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

  // Báo cáo đối chiếu hiện trên màn hình: Device đang "Đang sử dụng" mà không có trong file Tanium. Chỉ đọc;
  // không cần đã bấm "Xem trước". deviceCodePrefixes: cùng ý nghĩa với exportMissingDevicesReport bên dưới.
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

  // Tải cùng báo cáo đó dưới dạng Excel. Đối chiếu Device đang "Đang sử dụng" trong hệ thống với chính file Tanium vừa chọn — không phụ
  // thuộc đã bấm "Xem trước" hay chưa, BE tự đọc lại file. Trả file .xlsx tải xuống + số lượng đọc
  // từ header (không phải body JSON). deviceCodePrefixes: tiền tố mã máy người dùng nhập (VD
  // ["YDC","YDF","YLC"]) — chỉ Device khớp 1 trong các tiền tố này mới được đối chiếu.
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
