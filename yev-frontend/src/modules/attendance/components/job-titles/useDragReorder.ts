import { useLayoutEffect, useRef, useState } from "react";

// Transparent 1x1 image replaces the browser's ghost, which looked doubled next to the dimmed original item.
let transparentDragImage: HTMLImageElement | null = null;
function getTransparentDragImage(): HTMLImageElement {
    if (!transparentDragImage) {
        transparentDragImage = new Image();
        transparentDragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7";
    }
    return transparentDragImage;
}

// FLIP animation: snapshot positions by key before reordering, invert with an untransitioned transform after
// render, force a reflow, then animate to 0. The dragged item is excluded so it stays still.
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
            void el.offsetHeight; // force reflow so the invert and the animate land in separate frames
            requestAnimationFrame(() => {
                el.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)";
                el.style.transform = "";
                // Clear the inline transition, otherwise it permanently overrides the Tailwind transition classes.
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
