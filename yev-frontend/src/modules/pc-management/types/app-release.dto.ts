// Khớp asset-api-fe.md §7f. "Bản mới nhất" = !isDeleted, versionCode lớn nhất (tính phía BE).
export interface AppReleaseDto {
    id: number;
    versionCode: number;
    versionName: string;
    minVersionCode: number;
    apkUrl: string;
    changelog: string | null;
}

// Body POST/PUT — id dùng cho PUT, POST bỏ qua.
export interface CreateUpdateAppReleaseDto {
    id: number;
    versionCode: number;
    versionName: string;
    minVersionCode: number;
    apkUrl: string;
    changelog: string | null;
}
