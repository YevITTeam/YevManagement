"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Render câu trả lời của AI (markdown) thành HTML.
//
// - `react-markdown` KHÔNG render raw HTML nếu không cài thêm `rehype-raw` — cố ý không cài, vì nội
//   dung ở đây do model sinh ra, cho phép HTML thô là mở đường cho XSS.
// - `remark-gfm` để có bảng, checklist, ~~gạch ngang~~, autolink — AI hay trả lời dạng bảng khi liệt
//   kê thiết bị/IP.
// - Tailwind v4 preflight reset sạch style của h1/ul/table..., và dự án KHÔNG cài
//   @tailwindcss/typography, nên phải tự khai báo class cho từng thẻ ở `components` bên dưới.
// - Markdown đang stream dở (chưa đóng ```, bảng thiếu dòng) vẫn render được — react-markdown parse
//   lại toàn bộ chuỗi mỗi lần text đổi nên không cần xử lý gì thêm.
export default function MarkdownMessage({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,

                h1: ({ children }) => (
                    <h1 className="mb-1.5 mt-3 text-base font-semibold text-[#191c1e] first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                    <h2 className="mb-1.5 mt-3 text-sm font-semibold text-[#191c1e] first:mt-0">{children}</h2>
                ),
                h3: ({ children }) => (
                    <h3 className="mb-1 mt-2.5 text-sm font-semibold text-[#5e3f3a] first:mt-0">{children}</h3>
                ),

                ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,

                strong: ({ children }) => <strong className="font-semibold text-[#191c1e]">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,

                a: ({ href, children }) => (
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#e3000f] underline underline-offset-2 hover:text-[#b40009]"
                    >
                        {children}
                    </a>
                ),

                // Bảng dễ tràn ngang trong bubble hẹp → cho cuộn ngang trong chính nó,
                // không để đẩy vỡ layout khung chat.
                table: ({ children }) => (
                    <div className="my-2 overflow-x-auto">
                        <table className="w-full border-collapse text-xs">{children}</table>
                    </div>
                ),
                thead: ({ children }) => <thead className="bg-[#eceef0]">{children}</thead>,
                th: ({ children }) => (
                    <th className="border border-[#e0e3e5] px-2 py-1 text-left font-semibold text-[#191c1e]">
                        {children}
                    </th>
                ),
                td: ({ children }) => (
                    <td className="border border-[#e0e3e5] px-2 py-1 align-top">{children}</td>
                ),

                code: ({ className, children }) => {
                    // react-markdown phân biệt code block bằng class "language-*"; không có class
                    // nghĩa là code inline.
                    const isBlock = Boolean(className);

                    if (isBlock) {
                        return (
                            <code className="block overflow-x-auto rounded bg-[#191c1e] px-3 py-2 font-mono text-xs text-[#f8fafc]">
                                {children}
                            </code>
                        );
                    }

                    return (
                        <code className="rounded bg-[#eceef0] px-1 py-0.5 font-mono text-[0.8125rem] text-[#930006]">
                            {children}
                        </code>
                    );
                },
                pre: ({ children }) => <pre className="my-2">{children}</pre>,

                blockquote: ({ children }) => (
                    <blockquote className="my-2 border-l-2 border-[#e3000f] pl-3 text-[#5e3f3a]">
                        {children}
                    </blockquote>
                ),

                hr: () => <hr className="my-3 border-t border-[#e0e3e5]" />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
