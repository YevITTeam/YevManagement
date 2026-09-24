"use client";

import { Bot, FilePlus2, ClipboardList } from "lucide-react";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

const tiles = [
    {
        title: "Đăng ký tăng ca",
        desc: "Lập đơn đề nghị làm ngoài giờ cho nhân viên của bạn.",
        link: "/ot/create",
        icon: <FilePlus2 className="h-8 w-8" />,
    },
    {
        title: "Đơn tăng ca",
        desc: "Đơn của tôi, chờ ký duyệt, chờ duyệt, đã xử lý và đơn bạn tham gia — theo tab.",
        link: "/ot/list",
        icon: <ClipboardList className="h-8 w-8" />,
    },
];

// Riêng biệt khỏi mảng tiles cố định ở trên vì mục này gate bằng permission (rollout ban đầu chỉ
// Admin, xem migration AddAttendanceAiChatPermission) — 2 tile kia không cần gate vì permission của
// chúng đã được cấp rộng cho mọi Role nghiệp vụ từ trước.
const aiChatTile = {
    title: "Trợ lý AI đăng ký tăng ca",
    desc: "Trò chuyện để AI tự đăng ký tăng ca (nháp) cho bạn.",
    link: "/ot/ai-chat",
    icon: <Bot className="h-8 w-8" />,
};

export default function OtHomePage() {
    const { user } = useAuth();
    const visibleTiles = hasPermission(user, "Attendance.AiChat.Use") ? [...tiles, aiChatTile] : tiles;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý tăng ca</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">Lập và duyệt Giấy đề nghị làm ngoài giờ.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {visibleTiles.map((tile) => (
                    <Link
                        key={tile.link}
                        href={tile.link}
                        // KHÔNG bật prefetch — xem comment ở PcManagerSidebar.tsx (2026-08-11).
                        prefetch={false}
                        className="group rounded-2xl border border-[#e0e3e5] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#e3000f] hover:shadow-md"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff4f2] text-[#e3000f] transition-colors group-hover:bg-[#ffe0e3]">
                            {tile.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-[#191c1e] transition-colors group-hover:text-[#e3000f]">
                            {tile.title}
                        </h3>
                        <p className="mt-2 text-sm text-[#5e3f3a]">{tile.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
