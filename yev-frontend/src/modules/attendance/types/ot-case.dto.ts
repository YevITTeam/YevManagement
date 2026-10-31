export interface OtCaseDto {
    id: number;
    code: string;
    description: string | null;
    descriptionJp: string | null;
    requireSignature: boolean;
    // JobTitleTerminalLevel; only 1/2/3 are valid.
    requiredApprovalLevel: number;
}
