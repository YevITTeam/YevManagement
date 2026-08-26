// workflow-module.md §4 — khớp enum DataSourceKind ở BE (Workflow.Domain.Enums.DataSourceKind).
// SqlQuery=4 tồn tại trong enum nhưng bị BE chặn tạo/sửa (chưa chốt cơ chế bảo mật) — FE không đưa
// vào danh sách lựa chọn được ở dropdown, chỉ giữ trong type để khớp giá trị BE trả về nếu có.
export const DataSourceKind = {
    Employees: 1,
    OrgUnits: 2,
    JobTitles: 3,
    SqlQuery: 4,
} as const;

export type DataSourceKind = (typeof DataSourceKind)[keyof typeof DataSourceKind];

export interface FormDataSourceDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    sourceKind: DataSourceKind;
    connectionName: string | null;
    sqlText: string | null;
    valueColumn: string;
    displayColumn: string;
    filterJson: string | null;
}

export interface CreateUpdateFormDataSourceDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    sourceKind: DataSourceKind;
    connectionName: string | null;
    sqlText: string | null;
    valueColumn: string;
    displayColumn: string;
    filterJson: string | null;
}
