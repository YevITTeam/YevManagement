// BE does not store conversations — FE keeps `history` and resends it every turn.

export type AiChatRole = "user" | "assistant";

export interface AiChatMessageDto {
    role: AiChatRole;
    content: string;
}

export interface AiChatRequestDto {
    message: string;
    history: AiChatMessageDto[];
    /** Null uses the BE default system prompt. */
    systemPrompt?: string | null;
    /** true enables deep reasoning (much slower). */
    think?: boolean;
    /** UI locale ("vi" | "ja") for the reply language; ignored when a custom systemPrompt is set. */
    locale?: string;
}

// Fields not applicable to a `type` are omitted from JSON (not null), so discriminate on `type`.
export type AiChatStreamEvent =
    | { type: "content"; text: string }
    | { type: "tool"; name: string }
    | { type: "device"; deviceId: number; deviceCode: string }
    | { type: "done" }
    | { type: "error"; message: string };
