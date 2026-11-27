"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Bot, Brain, Check, Copy, ExternalLink, Loader2, Search, Send, Sparkles, Square, SquarePen, User } from "lucide-react";

import { AttendanceAiChatApi } from "@/modules/attendance-ai-chat/api/attendance-ai-chat.api";
import MarkdownMessage from "@/modules/ai-chat/components/MarkdownMessage";
import { readAiChatStream } from "@/modules/ai-chat/lib/ai-chat-stream";
import type { AttendanceAiChatMessageDto, AttendanceAiChatStreamEvent } from "@/modules/attendance-ai-chat/types/attendance-ai-chat.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter } from "@/navigation";
import { IconButton, ToggleChip } from "@/components/ui/ListToolbar";
import { useFitViewport } from "@/components/ui/TableScroll";

// Tool labels live under AiChat.tool.<BE tool name>; keep in sync with AttendanceAiChatToolDefinitions.cs.
const SUGGESTION_KEYS = ["suggestion1", "suggestion2", "suggestion3", "suggestion4"] as const;

interface OtFormRef {
    otFormId: number;
}

interface ChatBubble extends AttendanceAiChatMessageDto {
    id: number;
    timestamp?: number;
    otFormRefs?: OtFormRef[];
}

// React Compiler forbids calling impure Date.now in render, so it is wrapped at module level.
const now = (): number => Date.now();

export default function AttendanceAiChatBox() {
    const t = useTranslations("Attendance.AiChat");
    const rootRef = useRef<HTMLDivElement>(null);
    const fitHeight = useFitViewport(rootRef);
    const { user } = useAuth();
    const canViewOtForm = hasPermission(user, "Attendance.OTForm.View");

    const [messages, setMessages] = useState<ChatBubble[]>([]);
    const [input, setInput] = useState("");
    const [streamingText, setStreamingText] = useState("");
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [otFormRefs, setOtFormRefs] = useState<OtFormRef[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [thinkEnabled, setThinkEnabled] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const nextIdRef = useRef(1);

    // Scroll only, no setState — a valid effect under React Compiler.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, streamingText, activeTools]);

    // Abort the stream on unmount to avoid leaking the connection.
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const send = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || isStreaming) {
            return;
        }

        // BE is stateless, so send the whole prior conversation; "tool" rows are excluded since BE rejects them.
        const history: AttendanceAiChatMessageDto[] = messages.map(({ role, content }) => ({ role, content }));
        const userBubble: ChatBubble = { id: nextIdRef.current++, role: "user", content: trimmed, timestamp: now() };

        setMessages((prev) => [...prev, userBubble]);
        setInput("");
        setStreamingText("");
        setActiveTools([]);
        setOtFormRefs([]);
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        let answer = "";
        let failed = false;
        const otFormRefsAcc: OtFormRef[] = [];

        try {
            const response = await AttendanceAiChatApi.streamChat(
                { message: trimmed, history, think: thinkEnabled },
                controller.signal
            );

            for await (const event of readAiChatStream<AttendanceAiChatStreamEvent>(response)) {
                if (event.type === "content") {
                    answer += event.text;
                    setStreamingText(answer);
                } else if (event.type === "tool") {
                    setActiveTools((prev) => (prev.includes(event.name) ? prev : [...prev, event.name]));
                } else if (event.type === "otform") {
                    if (!otFormRefsAcc.some((ref) => ref.otFormId === event.otFormId)) {
                        otFormRefsAcc.push({ otFormId: event.otFormId });
                        setOtFormRefs([...otFormRefsAcc]);
                    }
                } else if (event.type === "error") {
                    failed = true;
                    toast.error(event.message || t("answerError"));
                    break;
                } else if (event.type === "done") {
                    break;
                }
            }
        } catch (error) {
            // User "Stop" also lands here and isn't an error. 403 bodies have no `message`, so the fallback must cover it.
            if (!controller.signal.aborted) {
                failed = true;
                toast.error(getApiErrorMessage(error, t("connectError")));
            }
        } finally {
            abortRef.current = null;

            // Keep the partial answer as a bubble so the next turn still has context.
            if (answer.trim()) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: nextIdRef.current++,
                        role: "assistant",
                        content: answer,
                        timestamp: now(),
                        otFormRefs: otFormRefsAcc,
                    },
                ]);
            } else if (!failed && !controller.signal.aborted) {
                toast.info(t("emptyAnswer"));
            }

            setStreamingText("");
            setActiveTools([]);
            setOtFormRefs([]);
            setIsStreaming(false);
        }
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void send(input);
    };

    const handleReset = () => {
        abortRef.current?.abort();
        setMessages([]);
        setStreamingText("");
        setActiveTools([]);
        setOtFormRefs([]);
        setInput("");
    };

    const isEmpty = messages.length === 0 && !isStreaming;
    const toolLabel = (name: string) => (t.has(`tool.${name}`) ? t(`tool.${name}`) : name);

    return (
        // Desktop height is the space left in <main>; phones keep page scrolling with a fixed-height box.
        <div ref={rootRef} style={{ height: fitHeight }} className="flex h-[75svh] flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-[#e0e3e5] px-4 py-2.5">
                <h1 className="text-sm font-semibold text-[#191c1e]">{t("title")}</h1>
                <div className="flex items-center gap-1.5">
                    <ToggleChip checked={thinkEnabled} onChange={setThinkEnabled} disabled={isStreaming} icon={Brain} label={t("thinkLabel")} title={t("thinkHint")} compact />
                    <IconButton icon={SquarePen} label={t("newChat")} onClick={handleReset} disabled={isEmpty} />
                </div>
            </div>

            {/* Not a preview: confirming really creates a record and sends an email, even while the form is Draft. */}
            <div className="flex items-start gap-2 border-b border-[#f5d0a9] bg-[#fff4e5] px-4 py-1.5 text-xs text-[#9a5b00]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("realFormWarning")}</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <Bot className="h-8 w-8 text-[#e3000f]" />
                        <p className="max-w-md text-sm text-[#5e3f3a]">{t("emptyHint")}</p>
                        <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                            {SUGGESTION_KEYS.map((key) => t(key)).map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => void send(suggestion)}
                                    className="flex items-start gap-2 rounded-xl border border-[#e0e3e5] bg-white px-3 py-2.5 text-left text-xs text-[#5e3f3a] shadow-sm transition hover:border-[#e3000f] hover:text-[#e3000f]"
                                >
                                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e3000f]" />
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((message) => (
                        <MessageRow key={message.id} message={message} canViewOtForm={canViewOtForm} />
                    ))
                )}

                {activeTools.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[#5e3f3a]">
                        <Search className="h-3.5 w-3.5 animate-pulse text-[#e3000f]" />
                        {t("processing", { tools: activeTools.map(toolLabel).join(", ") })}
                    </div>
                )}

                {streamingText && (
                    <MessageRow
                        message={{ id: -1, role: "assistant", content: streamingText, otFormRefs }}
                        canViewOtForm={canViewOtForm}
                        isLive
                    />
                )}

                {isStreaming && !streamingText && activeTools.length === 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-[#8a8f94]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t("composing")}
                    </p>
                )}

                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#e0e3e5] px-4 py-2.5">
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void send(input);
                            }
                        }}
                        rows={2}
                        placeholder={t("inputPlaceholder")}
                        title={t("inputHint")}
                        aria-label={t("inputPlaceholder")}
                        className="flex-1 resize-none rounded-lg border border-[#e0e3e5] px-3 py-2 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />

                    {isStreaming ? (
                        <IconButton icon={Square} label={t("stop")} onClick={() => abortRef.current?.abort()} />
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            title={t("send")}
                            aria-label={t("send")}
                            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

function MessageRow({
    message,
    canViewOtForm,
    isLive = false,
}: {
    message: ChatBubble;
    canViewOtForm: boolean;
    isLive?: boolean;
}) {
    const t = useTranslations("Attendance.AiChat");
    const locale = useLocale();
    const router = useRouter();
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t("copyError"));
        }
    };

    return (
        <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-[#eceef0] text-[#5e3f3a]" : "bg-[#e3000f] text-white"
                    }`}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                {/* AI replies are markdown; user text stays plain so their input isn't mangled. `min-w-0` lets tables scroll. */}
                <div
                    className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${isUser
                        ? "whitespace-pre-wrap bg-[#fff4f2] text-[#191c1e]"
                        : "border border-[#e0e3e5] bg-white text-[#191c1e]"
                        }`}
                >
                    {isUser ? message.content : <MarkdownMessage content={message.content} />}
                </div>

                {!isLive && message.content && (
                    <div className="flex items-center gap-2 px-1 text-[11px] text-[#8a8f94]">
                        {!isUser && (
                            <button
                                type="button"
                                onClick={() => void handleCopy()}
                                title={copied ? t("copied") : t("copy")}
                                aria-label={copied ? t("copied") : t("copy")}
                                className="flex cursor-pointer items-center rounded p-0.5 transition hover:text-[#5e3f3a]"
                            >
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                        )}
                        <span>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                    </div>
                )}

                {!isUser && canViewOtForm && message.otFormRefs && message.otFormRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                        {message.otFormRefs.map((ref) => (
                            <button
                                key={ref.otFormId}
                                type="button"
                                onClick={() =>
                                    router.push({ pathname: "/ot/forms/edit", query: { id: String(ref.otFormId) } })
                                }
                                title={t("openFormHint")}
                                className="flex cursor-pointer items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f]"
                            >
                                <ExternalLink className="h-3 w-3" />
                                {t("openForm", { id: ref.otFormId })}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
