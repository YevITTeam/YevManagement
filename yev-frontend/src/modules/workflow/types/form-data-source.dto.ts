// Must match BE enum DataSourceKind. SqlQuery is blocked by BE and not offered in the dropdown;
// it stays in the type only to decode existing values.
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
