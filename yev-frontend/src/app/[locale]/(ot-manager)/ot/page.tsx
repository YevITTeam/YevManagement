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
        { title: t("createTitle"), desc: t("createDesc"), link: "/ot/create", icon: <FilePlus2 className="h-8 w-8" /> },
        { title: t("listTitle"), desc: t("listDesc"), link: "/ot/list", icon: <ClipboardList className="h-8 w-8" /> },
    ];
    // Gated by permission (initially Admin only); the two tiles above are open to every business role.
    const aiChatTile = { title: t("aiChatTitle"), desc: t("aiChatDesc"), link: "/ot/ai-chat", icon: <Bot className="h-8 w-8" /> };
    const visibleTiles = hasPermission(user, "Attendance.AiChat.Use") ? [...tiles, aiChatTile] : tiles;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {visibleTiles.map((tile) => (
                    <Link
                        key={tile.link}
                        href={tile.link}
                        // Do not enable prefetch — see PcManagerSidebar.tsx.
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
