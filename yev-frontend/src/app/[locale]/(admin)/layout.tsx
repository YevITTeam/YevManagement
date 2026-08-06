export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // h-full (không phải min-h-full) — admin/page.tsx bên dưới cần sidebar TỰ STRETCH khớp chiều cao
    // nội dung bên cạnh (flex align-items:stretch), nhưng % height chỉ resolve khi tổ tiên có
    // `height` xác định — `min-height` không tính. main (layout.tsx gốc) có chiều cao thật nhờ flex-1,
    // nên h-full ở đây bám đúng vào đó; admin/page.tsx dùng tiếp h-full (không phải min-h-full) để nối
    // mạch. Nội dung dài hơn 1 màn hình vẫn tràn ra bình thường (không set overflow-hidden ở giữa) và
    // để <main> gốc cuộn — không phá nguyên tắc "1 chủ cuộn duy nhất" ở DESIGN_SYSTEM.md §3.
    return (
        <section className="admin-wrapper h-full">
            {children}
        </section>
    );
}