"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

const MIN_HEIGHT = 320;
// Bottom padding of the manager layouts (pb-4).
const PAGE_BOTTOM_GAP = 16;
// Phones and small tablets keep plain page scrolling; nested scroll areas are awkward on touch.
const DESKTOP_QUERY = "(min-width: 768px)";

// Max height that makes the page fit the viewport: everything above (title, filters) and below (pagination) stays
// on screen while rows scroll inside. Measured against <main>, the app's only scroll container ([locale]/layout.tsx).
export function useFitViewport(ref: RefObject<HTMLElement | null>): number | undefined {
    const [maxHeight, setMaxHeight] = useState<number>();

    useLayoutEffect(() => {
        const element = ref.current;
        const main = element?.closest("main");
        if (!element || !main) return;

        // The card holding the table; its pagination footer must stay visible under the rows.
        const card = element.closest("section") ?? element;

        const update = () => {
            if (!window.matchMedia(DESKTOP_QUERY).matches) return setMaxHeight(undefined);
            const box = element.getBoundingClientRect();
            const top = box.top - main.getBoundingClientRect().top + main.scrollTop;
            const below = card.getBoundingClientRect().bottom - box.bottom + PAGE_BOTTOM_GAP;
            setMaxHeight(Math.max(MIN_HEIGHT, Math.floor(main.clientHeight - top - below)));
        };

        update();
        // Filters wrapping or chips appearing resize the card and move the table; the cap doesn't change `top` or `below`.
        const observer = new ResizeObserver(update);
        observer.observe(main);
        observer.observe(card);
        window.addEventListener("resize", update);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [ref]);

    return maxHeight;
}

// Wraps a list table: scrolls inside the viewport with a sticky header row.
export function TableScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const maxHeight = useFitViewport(ref);
    return (
        <div ref={ref} style={{ maxHeight }} className={`overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 ${className}`}>
            {children}
        </div>
    );
}
