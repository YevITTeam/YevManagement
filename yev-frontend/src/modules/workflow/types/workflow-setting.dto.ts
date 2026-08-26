export interface WorkflowSettingDto {
    maxAttachmentSizeMb: number;
    allowedFileExtensions: string;
    maxAttachmentPerRequest: number;
    emailTokenExpiryDays: number;
}

export type UpdateWorkflowSettingDto = WorkflowSettingDto;
