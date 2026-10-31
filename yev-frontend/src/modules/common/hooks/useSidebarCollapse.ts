"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "yev-sidebar-collapsed";
// Below md the sidebar is an off-canvas drawer; globals.css zeroes --sidebar-w there.
const MOBILE_QUERY = "(max-width: 767.98px)";

export const SIDEBAR_WIDTH_EXPANDED = "13.75rem";
export const SIDEBAR_WIDTH_COLLAPSED = "4.5rem";

function applyWidthVar(collapsed: boolean) {
    document.documentElement.style.setProperty(
        "--sidebar-w",
        collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
    );
}

// useSyncExternalStore over localStorage avoids setState in effect and stays SSR-safe (server = expanded).
const listeners = new Set<() => void>();
let mobileOpen = false;

function notify() {
    listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    const media = window.matchMedia(MOBILE_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
        media.removeEventListener("change", onStoreChange);
    };
}

const getStoredCollapsed = () => window.localStorage.getItem(STORAGE_KEY) === "1";
const getIsMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const getMobileOpen = () => mobileOpen;
const serverFalse = () => false;

export function setSidebarMobileOpen(open: boolean) {
    if (mobileOpen === open) return;
    mobileOpen = open;
    notify();
}

export function useSidebarCollapse() {
    const storedCollapsed = useSyncExternalStore(subscribe, getStoredCollapsed, serverFalse);
    const isMobile = useSyncExternalStore(subscribe, getIsMobile, serverFalse);
    const isMobileOpen = useSyncExternalStore(subscribe, getMobileOpen, serverFalse);
    // The drawer always shows labels; the icon-only rail is a desktop preference.
    const collapsed = storedCollapsed && !isMobile;

    // Pure DOM side effect, no setState.
    useEffect(() => {
        applyWidthVar(storedCollapsed);
    }, [storedCollapsed]);

    const toggle = useCallback(() => {
        if (getIsMobile()) {
            setSidebarMobileOpen(false);
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, getStoredCollapsed() ? "0" : "1");
        notify();
    }, []);

    return { collapsed, toggle, isMobile, mobileOpen: isMobileOpen };
}

// Drawer position for the fixed <aside>: hidden off-canvas below md until opened from the header.
export function sidebarDrawerClass(mobileOpen: boolean) {
    return `max-md:shadow-xl ${mobileOpen ? "" : "max-md:-translate-x-full"}`;
}
