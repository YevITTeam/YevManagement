"use client";

import { Bot, FilePlus2, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

export default function OtHomePage() {
    const t = useTranslations("Attendance.OtHome");
    const { user } = useAuth();

    const tiles = [
        { title: t("createTitle"), link: "/ot/create", icon: <FilePlus2 className="h-6 w-6" /> },
        { title: t("listTitle"), link: "/ot/list", icon: <ClipboardList className="h-6 w-6" /> },
    ];
    // Gated by permission (initially Admin only); the two tiles above are open to every business role.
    const aiChatTile = { title: t("aiChatTitle"), link: "/ot/ai-chat", icon: <Bot className="h-6 w-6" /> };
    const visibleTiles = hasPermission(user, "Attendance.AiChat.Use") ? [...tiles, aiChatTile] : tiles;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleTiles.map((tile) => (
                    <Link
                        key={tile.link}
                        href={tile.link}
                        // Do not enable prefetch — see PcManagerSidebar.tsx.
                        prefetch={false}
                        className="group flex items-center gap-4 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm transition hover:border-[#e3000f] hover:shadow-md"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f] transition-colors group-hover:bg-[#ffe0e3]">
                            {tile.icon}
                        </div>
                        <h3 className="text-base font-semibold text-[#191c1e] transition-colors group-hover:text-[#e3000f]">{tile.title}</h3>
                    </Link>
                ))}
            </div>
        </div>
    );
}
