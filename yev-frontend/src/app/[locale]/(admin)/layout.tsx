export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // min-h-full — [locale]/layout.tsx đã là chủ chiều cao + vùng cuộn DUY NHẤT của app (xem
    // DESIGN_SYSTEM.md §3). Trước đây section không khai gì cả (className rỗng, không CSS) làm
    // đứt mạch chiều cao, khiến h-full ở admin/page.tsx bên dưới không resolve được.
    return (
        <section className="admin-wrapper min-h-full">
            {children}
        </section>
    );
}