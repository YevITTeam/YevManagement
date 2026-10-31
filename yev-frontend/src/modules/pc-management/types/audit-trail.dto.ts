// Written by BE, read-only on FE. old/new values are JSON {field: value} of changed fields only; null when N/A (e.g. Create).
export interface AuditTrailDto {
    id: number;
    tableName: string;
    recordId: number;
    // Display label built by BE, e.g. "192.168.1.5 (PC-001)".
    recordName: string;
    // 1 = single action; >1 = merged bulk action (e.g. IP range), then oldValues is null and newValues
    // holds AuditTrailBulkValuesDto JSON instead of a field diff.
    affectedCount: number;
    action: string; // "Create" | "Update" | "Delete" | "Restore"
    oldValues: string | null;
    newValues: string | null;
    changedBy: string;
    changedAt: string;
}

// newValues shape when affectedCount > 1; recordNames is capped at 50, truncated=true means more exist.
export interface AuditTrailBulkValuesDto {
    affectedCount: number;
    recordIds: number[];
    recordNames: string[];
    truncated: boolean;
}
