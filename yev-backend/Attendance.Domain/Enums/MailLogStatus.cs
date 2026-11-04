namespace Attendance.Domain.Enums;

public enum MailLogStatus
{
    // Waiting in the outbox; LastError set means a transient failure is being retried.
    Queued = 0,
    Sent = 1,
    Failed = 2,
    Skipped = 3
}
