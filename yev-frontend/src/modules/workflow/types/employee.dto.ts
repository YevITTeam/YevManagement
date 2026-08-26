export interface EmployeeDto {
    id: number;
    employeeCode: string;
    fullName: string;
    fullNameJp: string | null;
    email: string | null;
    position: string | null;
    userId: number | null;
    isActive: boolean;
}

export interface CreateUpdateEmployeeDto {
    employeeCode: string;
    fullName: string;
    fullNameJp: string | null;
    email: string | null;
    position: string | null;
    userId: number | null;
    isActive: boolean;
}
