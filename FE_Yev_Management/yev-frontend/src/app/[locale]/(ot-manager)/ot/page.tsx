"use client";

import { FilePlus2, ClipboardList, ClipboardCheck } from "lucide-react";
import { Link } from "@/navigation";

const tiles = [
    {
        title: "Tạo đơn tăng ca",
        desc: "Lập đơn đề nghị làm ngoài giờ cho nhóm của bạn.",
        link: "/ot/create",
        icon: <FilePlus2 className="h-8 w-8" />,
    },
    {
        title: "Đơn của tôi",
        desc: "Theo dõi trạng thái các đơn tăng ca bạn đã tạo.",
        link: "/ot/my-forms",
        icon: <ClipboardList className="h-8 w-8" />,
    },
    {
        title: "Chờ tôi duyệt",
        desc: "Danh sách đơn đang chờ bạn duyệt ở cấp hiện tại.",
        link: "/ot/pending-approvals",
        icon: <ClipboardCheck className="h-8 w-8" />,
    },
];

export default function OtHomePage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý tăng ca</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">Lập và duyệt Giấy đề nghị làm ngoài giờ.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {tiles.map((tile) => (
                    <Link
                        key={tile.link}
                        href={tile.link}
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
