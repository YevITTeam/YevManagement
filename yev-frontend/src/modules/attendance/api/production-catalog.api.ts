import { api } from "@/lib/client";
import type {
    ProductionCatalogItemDto,
    ProductionCatalogKind,
    SaveProductionCatalogItemDto,
} from "@/modules/attendance/types/production-catalog.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_CATALOG: {
        gridList: (kind: ProductionCatalogKind) => `/ProductionCatalog/${kind}/grid-list`,
        create: (kind: ProductionCatalogKind) => `/ProductionCatalog/${kind}`,
        item: (kind: ProductionCatalogKind, id: number) => `/ProductionCatalog/${kind}/${id}`,
    },
} as const;

export interface GetProductionCatalogParams {
    pageIndex: number;
    pageSize: number;
    keyword?: string;
    teamId?: number;
}

export const ProductionCatalogApi = {
    getPage: async (kind: ProductionCatalogKind, params: GetProductionCatalogParams) => {
        const query = new URLSearchParams({ PageIndex: String(params.pageIndex), PageSize: String(params.pageSize) });
        if (params.keyword) query.set("Keyword", params.keyword);
        if (params.teamId !== undefined) query.set("TeamId", String(params.teamId));
        const response = await api.get<ApiResponseWithPageNation<ProductionCatalogItemDto>>(`${ENDPOINTS.PRODUCTION_CATALOG.gridList(kind)}?${query}`);
        return response.data;
    },
    create: async (kind: ProductionCatalogKind, data: SaveProductionCatalogItemDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.PRODUCTION_CATALOG.create(kind), data);
        return response.data;
    },
    update: async (kind: ProductionCatalogKind, id: number, data: SaveProductionCatalogItemDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.PRODUCTION_CATALOG.item(kind, id), data);
        return response.data;
    },
    remove: async (kind: ProductionCatalogKind, id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.PRODUCTION_CATALOG.item(kind, id));
        return response.data;
    },
};

export { ENDPOINTS };
