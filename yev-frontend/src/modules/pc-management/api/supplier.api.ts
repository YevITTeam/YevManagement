import { api } from "@/lib/client";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    SUPPLIER: {
        getSupplierPageNation: "/Supplier/grid-list",
        getAllSuppliers: "/Supplier/all",
        getSupplierById: (supplierId: number) => `/Supplier/${supplierId}`,
        updateSupplier: (supplierId: number) => `/Supplier/${supplierId}`,
        deleteSupplier: (supplierId: number) => `/Supplier/${supplierId}`,
        createSupplier: "/Supplier"
    }
} as const;

export interface GetSupplierPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const SupplierApi = {
    getSupplierPageNation: async (params?: GetSupplierPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.SUPPLIER.getSupplierPageNation}?${queryString}` : ENDPOINTS.SUPPLIER.getSupplierPageNation;
        const response = await api.get<ApiResponseWithPageNation<SupplierDto>>(url);
        return response.data;
    },
    getAllSuppliers: async () => {
        const response = await api.get<ApiResponse<SupplierDto[]>>(ENDPOINTS.SUPPLIER.getAllSuppliers);
        return response.data;
    },
    getSupplierById: async (supplierId: number) => {
        const response = await api.get<ApiResponse<SupplierDto>>(ENDPOINTS.SUPPLIER.getSupplierById(supplierId));
        return response.data;
    },
    updateSupplier: async (supplierId: number, supplierData: Partial<SupplierDto>) => {
        const response = await api.put<ApiResponse<SupplierDto>>(ENDPOINTS.SUPPLIER.updateSupplier(supplierId),
            {
                id: supplierId,
                ...supplierData
            });
        return response.data;
    },
    deleteSupplier: async (supplierId: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.SUPPLIER.deleteSupplier(supplierId));
        return response.data;
    },
    createSupplier: async (supplierData: Omit<SupplierDto, "id">) => {
        const response = await api.post<ApiResponse<SupplierDto>>(ENDPOINTS.SUPPLIER.createSupplier, supplierData);
        return response.data;
    }
}