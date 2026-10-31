// "Latest" = non-deleted release with the highest versionCode, computed by BE.
export interface AppReleaseDto {
    id: number;
    versionCode: number;
    versionName: string;
    minVersionCode: number;
    apkUrl: string;
    changelog: string | null;
}

// id is used by PUT and ignored by POST.
export interface CreateUpdateAppReleaseDto {
    id: number;
    versionCode: number;
    versionName: string;
    minVersionCode: number;
    apkUrl: string;
    changelog: string | null;
}
