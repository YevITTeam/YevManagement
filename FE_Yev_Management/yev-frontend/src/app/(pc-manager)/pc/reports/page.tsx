import Link from "next/link";

const summaryCards = [
    {
        label: "Tổng tài sản",
        value: "4",
        tone: "text-[#191c1e]",
    },
    {
        label: "Đang kết nối",
        value: "2",
        tone: "text-[#191c1e]",
    },
    {
        label: "Cần cập nhật",
        value: "1",
        tone: "text-[#e3000f]",
    },
    {
        label: "Trạng thái hệ thống",
        value: "Tối ưu",
        tone: "text-[#191c1e]",
    },
];

export default function PcReportsPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-[32px] font-semibold text-[#191c1e]">Báo cáo thiết bị</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">Tổng hợp tình trạng thiết bị và hệ thống quản lý.</p>
                </div>

                <Link
                    href="/pc"
                    className="inline-flex h-10 items-center rounded-md border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f8fafc]"
                >
                    ← Quay lại danh sách
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <div key={card.label} className="border border-[#e0e3e5] bg-white p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">{card.label}</div>
                        <div className={`mt-3 text-[32px] font-semibold ${card.tone}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[#191c1e]">Thông tin nhanh</h2>
                <p className="mt-2 text-sm text-[#5e3f3a]">
                    Trang thống kê hiện đang hiển thị tổng quan số lượng thiết bị, tình trạng hoạt động và các chỉ số cần chú ý.
                </p>
            </div>
        </div>
    );
}
