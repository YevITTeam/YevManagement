export interface GroupDto {
    id: number;
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentId: number;
    departmentNameVn: string;
    workshopId: number;
    workshopNameVn: string;
    allowEatLater: boolean;
}
