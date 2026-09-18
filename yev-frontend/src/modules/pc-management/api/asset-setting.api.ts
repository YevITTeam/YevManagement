import { api } from "@/lib/client";
import type { AssetSettingDto, UpdateAssetSettingDto } from "@/modules/pc-management/types/asset-setting.dto";
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
    updateAssetSetting: async (data: UpdateAssetSettingDto) => {
        const response = await api.put<ApiResponse<AssetSettingDto>>(ENDPOINTS.ASSET_SETTING.update, data);
        return response.data;
    },
}

export { ENDPOINTS };
