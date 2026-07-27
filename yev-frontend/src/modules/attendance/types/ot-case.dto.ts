export interface OtCaseDto {
    id: number;
    code: string;
    description: string | null;
    requireSignature: boolean;
    // ApprovalLevel (docs/attendance-api-fe.md §2) — chỉ nên chọn 1/2/3, không dùng 0=Submitter.
    requiredApprovalLevel: number;
}
