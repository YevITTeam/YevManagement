import { useLayoutEffect, useRef, useState } from "react";

// Ảnh 1x1 trong suốt dùng chung cho MỌI lần kéo — thay ảnh ghost mặc định của trình duyệt (bản sao mờ
// nửa trong suốt trôi theo con trỏ, chính là thứ gây cảm giác "xuất hồn" khi kết hợp với item gốc cũng
// bị làm mờ opacity-50). Ẩn hẳn ghost mặc định, chỉ còn item gốc được tô đậm ngay tại chỗ + các item
// khác trượt mượt nhường chỗ — cảm giác "cầm" trực quan hơn nhiều so với 1 bản mờ bay lơ lửng.
let transparentDragImage: HTMLImageElement | null = null;
function getTransparentDragImage(): HTMLImageElement {
    if (!transparentDragImage) {
        transparentDragImage = new Image();
        transparentDragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7";
    }
    return transparentDragImage;
}

// Kéo-thả sắp xếp lại 1 mảng bằng HTML5 Drag & Drop thuần (không thêm thư viện ngoài) — dùng chung
// cho 2 khối bước duyệt trong ApprovalStepManager.tsx thay cho 2 nút mũi tên trước đây.
//
// Có animation FLIP (First-Last-Invert-Play) khi thứ tự đổi: các item bị đẩy chỗ TRƯỢT mượt sang vị
// trí mới thay vì nhảy khựng ngay lập tức. Cách làm — không phụ thuộc thư viện ngoài:
//   1. NGAY TRƯỚC khi đổi thứ tự (trong handleDragOver) — chụp lại vị trí hiện tại (getBoundingClientRect)
//      của mọi item, lưu theo `key` (KHÔNG theo index, vì index sẽ đổi ngay sau đó).
//   2. Sau khi React render lại theo thứ tự mới (useLayoutEffect theo dõi `items`) — với mỗi item, so
//      vị trí MỚI với vị trí ĐÃ CHỤP theo đúng key: lệch bao nhiêu thì dịch ngược lại y hệt bằng
//      transform, KHÔNG bật transition (để mắt không thấy bước "dịch giả" này).
//   3. Ép trình duyệt reflow 1 lần (đọc `offsetHeight`) rồi mới sang frame kế tiếp (requestAnimationFrame)
//      mới bật transition + trả transform về 0 — trình duyệt tự animate mượt từ vị trí "giả" về vị trí
//      thật. Thiếu bước ép reflow này trình duyệt có thể gộp 2 lần đổi style làm 1, không animate.
// Item ĐANG được kéo (dragIndex) không tham gia animate này — nó cần đứng yên để nhận highlight riêng
// (xem className tô đậm ở ApprovalStepManager.tsx), animate theo sẽ giật.
export function useDragReorder<T>(
    items: T[],
    onChange: (next: T[]) => void,
    getKey: (item: T) => string | number
) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const nodesRef = useRef(new Map<string | number, HTMLElement>());
    const prevRectsRef = useRef(new Map<string | number, DOMRect>());
    const draggingKeyRef = useRef<string | number | null>(null);

    const registerNode = (key: string | number) => (el: HTMLElement | null) => {
        if (el) nodesRef.current.set(key, el);
        else nodesRef.current.delete(key);
    };

    useLayoutEffect(() => {
        const prevRects = prevRectsRef.current;
        if (prevRects.size === 0) return;
        nodesRef.current.forEach((el, key) => {
            if (key === draggingKeyRef.current) return;
            const prev = prevRects.get(key);
            if (!prev) return;
            const next = el.getBoundingClientRect();
            const dx = prev.left - next.left;
            const dy = prev.top - next.top;
            if (dx === 0 && dy === 0) return;
            el.style.transition = "none";
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            void el.offsetHeight; // ép reflow — tách "dịch giả" và "animate về 0" thành 2 frame riêng
            requestAnimationFrame(() => {
                el.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)";
                el.style.transform = "";
                // Dọn lại "transition" inline sau khi animate xong — nếu không, nó đè vĩnh viễn lên
                // transition (box-shadow/border-color) khai báo bằng className Tailwind, khiến item
                // này mất hiệu ứng mượt ở những lần đổi style khác sau đó (VD tới lượt chính nó được kéo).
                el.addEventListener("transitionend", () => { el.style.transition = ""; }, { once: true });
            });
        });
        prevRectsRef.current = new Map();
    }, [items]);

    const handleDragStart = (index: number) => (event: React.DragEvent) => {
        setDragIndex(index);
        draggingKeyRef.current = getKey(items[index]);
        event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (index: number) => (event: React.DragEvent) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const rects = new Map<string | number, DOMRect>();
        nodesRef.current.forEach((el, key) => rects.set(key, el.getBoundingClientRect()));
        prevRectsRef.current = rects;
        const next = [...items];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        setDragIndex(index);
        onChange(next);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        draggingKeyRef.current = null;
    };

    return { dragIndex, handleDragStart, handleDragOver, handleDragEnd, registerNode };
}
