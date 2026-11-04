// 0 Queued (lastError set = retrying), 1 Sent, 2 Failed, 3 Skipped (recipient has no email).
export type AttendanceMailLogStatus = 0 | 1 | 2 | 3;

export interface AttendanceMailLogDto {
    id: number;
    recipientUserName: string | null;
    toEmail: string | null;
    subject: string;
    status: AttendanceMailLogStatus;
    attempts: number;
    lastError: string | null;
    // AD account whose action triggered the mail; "System" for background jobs, "EmailLink" for public confirm links.
    requestedBy: string;
    createdAt: string;
    sentAt: string | null;
}
