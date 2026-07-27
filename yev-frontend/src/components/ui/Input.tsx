import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

export default function Input({ className = "", ...props }: InputProps) {
    return (
        <input
            className={`w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-brand-black outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`}
            {...props}
        />
    );
}
