"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Bot, RotateCcw, Search, Send, Square, User } from "lucide-react";

import { AiChatApi } from "@/modules/ai-chat/api/ai-chat.api";
import MarkdownMessage from "@/modules/ai-chat/components/MarkdownMessage";
import { readAiChatStream } from "@/modules/ai-chat/lib/ai-chat-stream";
import type { AiChatMessageDto } from "@/modules/ai-chat/types/ai-chat.dto";
import { getApiErrorMessage } from "@/lib/apiError";

// Tên tool BE trả về là snake_case kỹ thuật (search_devices...). Người dùng không cần biết tool là
// gì, chỉ cần biết hệ thống đang tra cứu cái gì — map sang nhãn tiếng Việt, tool lạ thì hiện chung.
// Khớp đúng 16 tool khai báo ở BE (Asset.Application/Dtos/AiChat/AiChatToolDefinitions.cs).
const TOOL_LABELS: Record<string, string> = {
    search_devices: "thiết bị",
    get_device_detail: "chi tiết thiết bị",
    get_device_report: "báo cáo thiết bị",
    get_device_change_history: "lịch sử thay đổi cấu hình",
    get_device_transfer_history: "lịch sử chuyển máy",
    search_branches: "chi nhánh",
    search_suppliers: "nhà cung cấp",
    search_device_types: "loại thiết bị",
    search_device_groups: "nhóm",
    search_device_departments: "bộ phận",
    search_software: "phần mềm",
    search_software_groups: "nhóm phần mềm",
    search_ip_addresses: "địa chỉ IP",
    search_ip_prefixes: "dải IP",
    search_audit_trail: "lịch sử thao tác",
    get_asset_settings: "cấu hình hệ thống",
};

const SUGGESTIONS = [
    "Có bao nhiêu thiết bị đang chờ thanh lý?",
    "PC-001 đang gắn IP nào?",
    "Liệt kê thiết bị của chi nhánh Bình Dương",
    "Dải IP 10.45.1 còn bao nhiêu địa chỉ trống?",
];

interface ChatBubble extends AiChatMessageDto {
    id: number;
}

export default function AiChatBox() {
    const [messages, setMessages] = useState<ChatBubble[]>([]);
    const [input, setInput] = useState("");
    const [streamingText, setStreamingText] = useState("");
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

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
        const userBubble: ChatBubble = { id: nextIdRef.current++, role: "user", content: trimmed };

        setMessages((prev) => [...prev, userBubble]);
        setInput("");
        setStreamingText("");
        setActiveTools([]);
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        let answer = "";
        let failed = false;

        try {
            const response = await AiChatApi.streamChat(
                { message: trimmed, history },
                controller.signal
            );

            for await (const event of readAiChatStream(response)) {
                if (event.type === "content") {
                    answer += event.text;
                    setStreamingText(answer);
                } else if (event.type === "tool") {
                    setActiveTools((prev) => (prev.includes(event.name) ? prev : [...prev, event.name]));
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
                    { id: nextIdRef.current++, role: "assistant", content: answer },
                ]);
            } else if (!failed && !controller.signal.aborted) {
                toast.info("AI không trả về nội dung nào cho câu hỏi này.");
            }

            setStreamingText("");
            setActiveTools([]);
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
        setInput("");
    };

    const isEmpty = messages.length === 0 && !isStreaming;

    return (
        <div className="flex h-[calc(100vh-9rem)] flex-col rounded-lg border border-[#e0e3e5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e0e3e5] px-5 py-3">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-[#e3000f]" />
                    <div>
                        <h1 className="text-sm font-semibold text-[#191c1e]">Trợ lý AI</h1>
                        <p className="text-xs text-[#8a8f94]">
                            Hỏi bằng tiếng Việt về thiết bị, IP, phần mềm, chi nhánh…
                        </p>
                    </div>
                </div>

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

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <Bot className="h-10 w-10 text-[#e0e3e5]" />
                        <p className="max-w-md text-sm text-[#5e3f3a]">
                            Đặt câu hỏi về dữ liệu quản lý PC. Trợ lý sẽ tự tra cứu trong hệ thống rồi trả lời.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => void send(suggestion)}
                                    className="rounded-full border border-[#e0e3e5] px-3 py-1.5 text-xs text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f]"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((message) => <MessageRow key={message.id} message={message} />)
                )}

                {activeTools.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[#5e3f3a]">
                        <Search className="h-3.5 w-3.5 animate-pulse text-[#e3000f]" />
                        Đang tra cứu {activeTools.map((name) => TOOL_LABELS[name] ?? name).join(", ")}…
                    </div>
                )}

                {streamingText && (
                    <MessageRow message={{ id: -1, role: "assistant", content: streamingText }} />
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

function MessageRow({ message }: { message: ChatBubble }) {
    const isUser = message.role === "user";

    return (
        <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-[#eceef0] text-[#5e3f3a]" : "bg-[#e3000f] text-white"
                    }`}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Câu trả lời của AI là markdown → render thành HTML. Tin nhắn người dùng giữ nguyên
                text thuần (whitespace-pre-wrap) vì họ gõ tay, đem parse markdown sẽ làm méo nội dung
                họ vừa nhập. `min-w-0` để bảng markdown cuộn ngang được trong flex item. */}
            <div
                className={`min-w-0 max-w-[85%] rounded-lg px-3 py-2 text-sm ${isUser
                    ? "whitespace-pre-wrap bg-[#eceef0] text-[#191c1e]"
                    : "border border-[#e0e3e5] bg-[#f8fafc] text-[#191c1e]"
                    }`}
            >
                {isUser ? message.content : <MarkdownMessage content={message.content} />}
            </div>
        </div>
    );
}
