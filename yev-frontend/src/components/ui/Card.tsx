import type { ReactNode } from "react";

interface CardProps {
    className?: string;
    children: ReactNode;
}

export default function Card({ className = "", children }: CardProps) {
    return (
        <div className={`overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-sm ${className}`}>
            {children}
        </div>
    );
}
