"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "react-toastify";
import {
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

import { AiChatApi } from "@/modules/ai-chat/api/ai-chat.api";
import MarkdownMessage from "@/modules/ai-chat/components/MarkdownMessage";
import { readAiChatStream } from "@/modules/ai-chat/lib/ai-chat-stream";
import type { AiChatMessageDto } from "@/modules/ai-chat/types/ai-chat.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useRouter } from "@/navigation";

// Tên tool BE trả về là snake_case kỹ thuật (search_devices...). Người dùng không cần biết tool là
// gì, chỉ cần biết hệ thống đang tra cứu cái gì — map sang nhãn tiếng Việt, tool lạ thì hiện chung.
// Khớp đúng 17 tool khai báo ở BE (Asset.Application/Dtos/AiChat/AiChatToolDefinitions.cs).
// Chỉ 7 tool BE còn cung cấp (AiChatToolDefinitions.cs, rút gọn 2026-07-30). Nhãn của các tool đã bỏ
// được xoá khỏi đây luôn để danh sách này không gợi ý sai về năng lực thật của trợ lý.
const TOOL_LABELS: Record<string, string> = {
    search_devices: "thiết bị",
    get_device_detail: "chi tiết thiết bị",
    search_device_groups: "nhóm thiết bị",
    search_device_departments: "bộ phận",
    search_ip_addresses: "địa chỉ IP",
    search_ip_prefixes: "dải IP",
    get_ip_prefix_usage: "tình trạng dải IP",
};

// Mỗi gợi ý phải là việc trợ lý LÀM ĐƯỢC THẬT bằng 7 tool trên, và dùng dữ liệu có thật trong hệ thống
// (mã máy/dải IP thật) để bấm vào là ra kết quả. Bộ gợi ý cũ đã bị xoá vì hứa những thứ không có tool
// nào làm được — "đếm thiết bị theo trạng thái" (không có tool thống kê theo trạng thái) và "liệt kê
// thiết bị theo chi nhánh" (DeviceFilterRequest không có filter chi nhánh), nên bấm vào là thất vọng.
const SUGGESTIONS = [
    "Dải IP 10.45.1 còn bao nhiêu địa chỉ trống?",
    "IP 10.45.1.20 có dùng được không, đang được máy nào dùng?",
    "Các máy ở chi nhánh Dĩ An",
    "Xem chi tiết cấu hình máy YDC-9875",
];

interface DeviceRef {
    id: number;
    deviceCode: string;
}

interface ChatBubble extends AiChatMessageDto {
    id: number;
    timestamp?: number;
    deviceRefs?: DeviceRef[];
}

// Tách riêng khỏi component: React Compiler cấm gọi hàm impure (Date.now) trực tiếp trong thân
// component/render — đưa ra ngoài thành hàm module-level rồi gọi qua tham chiếu là cách chuẩn đã
// dùng ở modules/schedule/components/ScheduleBoard.tsx (`makeId`).
const now = (): number => Date.now();

const formatTime = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";

export default function AiChatBox() {
    const { user } = useAuth();
    const canViewDevice = hasPermission(user, "Asset.Device.View");
    const locale = useLocale();

    const [messages, setMessages] = useState<ChatBubble[]>([]);
    const [input, setInput] = useState("");
    const [streamingText, setStreamingText] = useState("");
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [deviceRefs, setDeviceRefs] = useState<DeviceRef[]>([]);
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
        // "tool" vì BE không hiểu nếu FE gửi ngược lại (xem asset-api-fe.md §7c).
        const history: AiChatMessageDto[] = messages.map(({ role, content }) => ({ role, content }));
        const userBubble: ChatBubble = { id: nextIdRef.current++, role: "user", content: trimmed, timestamp: now() };

        setMessages((prev) => [...prev, userBubble]);
        setInput("");
        setStreamingText("");
        setActiveTools([]);
        setDeviceRefs([]);
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        let answer = "";
        let failed = false;
        const deviceRefsAcc: DeviceRef[] = [];

        try {
            const response = await AiChatApi.streamChat(
                { message: trimmed, history, think: thinkEnabled, locale },
                controller.signal
            );

            for await (const event of readAiChatStream(response)) {
                if (event.type === "content") {
                    answer += event.text;
                    setStreamingText(answer);
                } else if (event.type === "tool") {
                    setActiveTools((prev) => (prev.includes(event.name) ? prev : [...prev, event.name]));
                } else if (event.type === "device") {
                    if (!deviceRefsAcc.some((ref) => ref.id === event.deviceId)) {
                        deviceRefsAcc.push({ id: event.deviceId, deviceCode: event.deviceCode });
                        setDeviceRefs([...deviceRefsAcc]);
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
            // Lỗi 403 (thiếu permission Asset.AiChat.Use) trả body không có field `message` nên
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
                        deviceRefs: deviceRefsAcc,
                    },
                ]);
            } else if (!failed && !controller.signal.aborted) {
                toast.info("AI không trả về nội dung nào cho câu hỏi này.");
            }

            setStreamingText("");
            setActiveTools([]);
            setDeviceRefs([]);
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
        setDeviceRefs([]);
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
                        <h1 className="text-sm font-semibold text-[#191c1e]">Trợ lý AI</h1>
                        <p className="text-xs text-[#8a8f94]">
                            Hỏi bằng tiếng Việt về thiết bị, IP, phần mềm, chi nhánh…
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-pressed={thinkEnabled}
                        disabled={isStreaming}
                        onClick={() => setThinkEnabled((prev) => !prev)}
                        title="Bật để AI suy luận kỹ hơn trước khi trả lời — chính xác hơn với câu hỏi phức tạp nhưng chậm hơn nhiều (khoảng 2-3 giây so với 15-20 giây)."
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

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4f2]">
                            <Bot className="h-8 w-8 text-[#e3000f]" />
                        </div>
                        <p className="max-w-md text-sm text-[#5e3f3a]">
                            Đặt câu hỏi về dữ liệu quản lý PC. Trợ lý sẽ tự tra cứu trong hệ thống rồi trả lời.
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
                        <MessageRow key={message.id} message={message} canViewDevice={canViewDevice} />
                    ))
                )}

                {activeTools.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[#5e3f3a]">
                        <Search className="h-3.5 w-3.5 animate-pulse text-[#e3000f]" />
                        Đang tra cứu {activeTools.map((name) => TOOL_LABELS[name] ?? name).join(", ")}…
                    </div>
                )}

                {streamingText && (
                    <MessageRow
                        message={{ id: -1, role: "assistant", content: streamingText, deviceRefs }}
                        canViewDevice={canViewDevice}
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
                        placeholder="Nhập câu hỏi… (Enter để gửi, Shift+Enter để xuống dòng)"
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
    canViewDevice,
    isLive = false,
}: {
    message: ChatBubble;
    canViewDevice: boolean;
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

                {!isUser && canViewDevice && message.deviceRefs && message.deviceRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                        {message.deviceRefs.map((ref) => (
                            <button
                                key={ref.id}
                                type="button"
                                onClick={() => router.push({ pathname: "/pc/devices", query: { id: String(ref.id) } })}
                                className="flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f]"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Xem chi tiết {ref.deviceCode}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
