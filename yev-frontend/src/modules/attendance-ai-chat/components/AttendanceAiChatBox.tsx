"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
    AlertTriangle,
    Bot,
    Brain,
    Check,
    Copy,
    ExternalLink,
    RotateCcw,
    Search,
    Send,
    Sparkles,
    Square,
    User,
} from "lucide-react";

import { AttendanceAiChatApi } from "@/modules/attendance-ai-chat/api/attendance-ai-chat.api";
import MarkdownMessage from "@/modules/ai-chat/components/MarkdownMessage";
import { readAiChatStream } from "@/modules/ai-chat/lib/ai-chat-stream";
import type { AttendanceAiChatMessageDto, AttendanceAiChatStreamEvent } from "@/modules/attendance-ai-chat/types/attendance-ai-chat.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter } from "@/navigation";

// Tên tool BE trả về là snake_case kỹ thuật — người dùng không cần biết tool là gì, chỉ cần biết hệ
// thống đang làm gì. Khớp đúng 7 tool khai báo ở BE
// (Attendance.Application/Dtos/AiChat/AttendanceAiChatToolDefinitions.cs).
const TOOL_LABELS: Record<string, string> = {
    search_departments: "bộ phận",
    search_groups: "nhóm",
    search_reasons: "lý do tăng ca",
    search_ot_cases: "trường hợp OT",
    search_employees_by_group: "nhân viên",
    get_my_create_scopes: "phạm vi được tạo đơn",
    create_ot_form_draft: "tạo đơn tăng ca",
};

const SUGGESTIONS = [
    "Tạo đơn tăng ca cho nhóm Kế toán ngày mai từ 18:00 đến 20:00",
    "Nhóm của tôi có những nhân viên nào?",
    "Tôi được phép tạo đơn cho nhóm/bộ phận nào?",
    "Có những trường hợp OT (TH1/TH2/TH3) nào?",
];

interface OtFormRef {
    otFormId: number;
}

interface ChatBubble extends AttendanceAiChatMessageDto {
    id: number;
    timestamp?: number;
    otFormRefs?: OtFormRef[];
}

// Tách riêng khỏi component: React Compiler cấm gọi hàm impure (Date.now) trực tiếp trong thân
// component/render — đưa ra ngoài thành hàm module-level rồi gọi qua tham chiếu, cùng pattern đã
// dùng ở modules/ai-chat/components/AiChatBox.tsx.
const now = (): number => Date.now();

const formatTime = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";

export default function AttendanceAiChatBox() {
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

    // Chỉ cuộn xuống đáy — không setState nên dùng effect ở đây là hợp lệ với React Compiler.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, streamingText, activeTools]);

    // Rời trang giữa lúc đang stream thì hủy request, tránh rò kết nối.
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const send = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || isStreaming) {
            return;
        }

        // `history` gửi lên là toàn bộ hội thoại TRƯỚC câu này (BE không lưu gì) — không kèm dòng
        // "tool" vì BE không hiểu nếu FE gửi ngược lại.
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
                    toast.error(event.message || "AI gặp lỗi khi trả lời.");
                    break;
                } else if (event.type === "done") {
                    break;
                }
            }
        } catch (error) {
            // Người dùng bấm "Dừng" cũng rơi vào đây, nhưng đó không phải lỗi để báo.
            // Lỗi 403 (thiếu permission Attendance.AiChat.Use) trả body không có field `message` nên
            // getApiErrorMessage rơi về fallback — viết fallback bao được cả 2 khả năng.
            if (!controller.signal.aborted) {
                failed = true;
                toast.error(
                    getApiErrorMessage(
                        error,
                        "Không gọi được trợ lý AI. Kiểm tra quyền truy cập hoặc kết nối tới máy chủ AI."
                    )
                );
            }
        } finally {
            abortRef.current = null;

            // Giữ lại phần đã trả lời dở (nếu có) làm 1 bubble hoàn chỉnh, để lượt sau vẫn có ngữ cảnh.
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
                toast.info("AI không trả về nội dung nào cho câu hỏi này.");
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

    return (
        <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] px-5 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4f2]">
                        <Bot className="h-5 w-5 text-[#e3000f]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-[#191c1e]">Trợ lý AI tạo đơn tăng ca</h1>
                        <p className="text-xs text-[#8a8f94]">
                            Hỏi bằng tiếng Việt để lập đơn — trợ lý sẽ tóm tắt và chờ bạn xác nhận trước khi tạo thật.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-pressed={thinkEnabled}
                        disabled={isStreaming}
                        onClick={() => setThinkEnabled((prev) => !prev)}
                        title="Bật để AI suy luận kỹ hơn trước khi trả lời — chính xác hơn nhưng chậm hơn nhiều."
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${thinkEnabled
                            ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                            : "border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f8fafc]"
                            }`}
                    >
                        <Brain className="h-3.5 w-3.5" />
                        Suy luận sâu
                        <span
                            className={`ml-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${thinkEnabled ? "bg-[#e3000f]" : "bg-[#e0e3e5]"
                                }`}
                        >
                            <span
                                className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${thinkEnabled ? "translate-x-3.5" : "translate-x-0.5"
                                    }`}
                            />
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isEmpty}
                        className="flex items-center gap-1.5 rounded-lg border border-[#e0e3e5] px-3 py-1.5 text-xs font-medium text-[#5e3f3a] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Hội thoại mới
                    </button>
                </div>
            </div>

            {/* Cảnh báo cố định — người dùng phải hiểu đây KHÔNG phải bản xem trước: xác nhận sẽ tạo
                thật 1 bản ghi và gửi thật 1 email, dù đơn còn ở trạng thái Nháp. */}
            <div className="flex items-start gap-2 border-b border-[#fde68a] bg-[#fffbeb] px-5 py-2 text-xs text-[#92400e]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                    Khi bạn xác nhận, hệ thống sẽ tạo THẬT 1 đơn tăng ca (trạng thái Nháp) và gửi email cho
                    Trưởng nhóm liên quan — vẫn cần Trưởng nhóm ký duyệt trên hệ thống sau đó.
                </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4f2]">
                            <Bot className="h-8 w-8 text-[#e3000f]" />
                        </div>
                        <p className="max-w-md text-sm text-[#5e3f3a]">
                            Mô tả đơn tăng ca cần lập (nhóm, ngày giờ, nhân viên...). Trợ lý sẽ tự tra cứu dữ liệu,
                            tóm tắt lại và chờ bạn xác nhận trước khi tạo thật.
                        </p>
                        <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                            {SUGGESTIONS.map((suggestion) => (
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
                        Đang xử lý {activeTools.map((name) => TOOL_LABELS[name] ?? name).join(", ")}…
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
                    <p className="text-xs text-[#8a8f94]">Trợ lý đang soạn câu trả lời…</p>
                )}

                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#e0e3e5] px-5 py-3">
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            // Enter gửi, Shift+Enter xuống dòng — quen thuộc với người dùng chat.
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void send(input);
                            }
                        }}
                        rows={2}
                        placeholder="Nhập yêu cầu lập đơn… (Enter để gửi, Shift+Enter để xuống dòng)"
                        className="flex-1 resize-none rounded-lg border border-[#e0e3e5] px-3 py-2 text-sm text-[#191c1e] outline-none focus:border-[#e3000f]"
                    />

                    {isStreaming ? (
                        <button
                            type="button"
                            onClick={() => abortRef.current?.abort()}
                            className="flex items-center gap-1.5 rounded-lg border border-[#e0e3e5] px-4 py-2 text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f8fafc]"
                        >
                            <Square className="h-3.5 w-3.5" />
                            Dừng
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Send className="h-3.5 w-3.5" />
                            Gửi
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
    const router = useRouter();
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Không thể sao chép nội dung.");
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
                {/* Câu trả lời của AI là markdown → render thành HTML. Tin nhắn người dùng giữ nguyên
                    text thuần (whitespace-pre-wrap) vì họ gõ tay, đem parse markdown sẽ làm méo nội dung
                    họ vừa nhập. `min-w-0` để bảng markdown cuộn ngang được trong flex item. */}
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
                                className="flex items-center gap-1 transition hover:text-[#5e3f3a]"
                            >
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? "Đã chép" : "Sao chép"}
                            </button>
                        )}
                        <span>{formatTime(message.timestamp)}</span>
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
                                className="flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f]"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Xem đơn vừa tạo #{ref.otFormId}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
