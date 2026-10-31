import { useRef } from "react";

// Mouse drag-to-scroll; skips interactive elements so inputs keep working. Attach [ref, onMouseDown] to the scroller.
export function useDragScroll<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);

    const onMouseDown = (event: React.MouseEvent<T>) => {
        const el = ref.current;
        if (!el || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("input, button, select, textarea, a, label, [role='checkbox']")) return;

        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = el.scrollLeft;
        const startTop = el.scrollTop;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";

        const onMove = (moveEvent: MouseEvent) => {
            el.scrollLeft = startLeft - (moveEvent.clientX - startX);
            el.scrollTop = startTop - (moveEvent.clientY - startY);
        };
        const onUp = () => {
            el.style.cursor = "";
            el.style.userSelect = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    return [ref, onMouseDown] as const;
}
