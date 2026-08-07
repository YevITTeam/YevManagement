export interface GroupDto {
    id: number;
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentId: number;
    departmentNameVn: string;
    requesterEmployeeId: number | null;
    requesterFullName: string | null;
    responsibleEmployeeId: number | null;
    responsibleFullName: string | null;
}
