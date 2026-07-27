export interface ApiResponse<T> {
    isSuccess: boolean;
    message: string;
    data: T;
    errors: unknown | null;
    timestamp: string;
}


export interface ApiResponseWithPageNation<T> {
    isSuccess: boolean;
    message: string;
    data: {
        data: T[];
        pageIndex: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean
    };
    errors: string[];
    timestamp: string;
}