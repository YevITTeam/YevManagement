import { api } from "@/lib/client";
import type { AssetSettingDto } from "@/modules/pc-management/types/asset-setting.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ASSET_SETTING: {
        get: "/AssetSetting",
        update: "/AssetSetting",
    }
} as const;

export const AssetSettingApi = {
    getAssetSetting: async () => {
        const response = await api.get<ApiResponse<AssetSettingDto>>(ENDPOINTS.ASSET_SETTING.get);
        return response.data;
    },
    updateAssetSetting: async (data: AssetSettingDto) => {
        const response = await api.put<ApiResponse<AssetSettingDto>>(ENDPOINTS.ASSET_SETTING.update, data);
        return response.data;
    },
}

export { ENDPOINTS };
