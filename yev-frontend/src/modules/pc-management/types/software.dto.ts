export interface SoftwareDto {
    id: number;
    softwareCode: string;
    softwareName: string;
    softwareType: string | null;
    publisher: string | null;
    softwareQuantity: number | null;
    softwarePriority: number | null;
    softwareGroupId: number;
    softwareGroupName: string;
}