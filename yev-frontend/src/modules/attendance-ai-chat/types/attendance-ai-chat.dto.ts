// BE does not store conversations. Mirrors ai-chat.dto.ts but kept separate: distinct endpoint and permission.

export type AttendanceAiChatRole = "user" | "assistant";

export interface AttendanceAiChatMessageDto {
    role: AttendanceAiChatRole;
    content: string;
}

export interface AttendanceAiChatRequestDto {
    message: string;
    history: AttendanceAiChatMessageDto[];
    /** Null uses the BE default system prompt. */
    systemPrompt?: string | null;
    /** true enables deep reasoning (much slower). */
    think?: boolean;
}

// Fields not applicable to a `type` are omitted from JSON (not null), so discriminate on `type`.
// "otform" carries the id of the Draft OT form actually created by create_ot_form_draft.
export type AttendanceAiChatStreamEvent =
    | { type: "content"; text: string }
    | { type: "tool"; name: string }
    | { type: "otform"; otFormId: number }
    | { type: "done" }
    | { type: "error"; message: string };
