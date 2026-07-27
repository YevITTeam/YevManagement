import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    className?: string;
    children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        "bg-brand-red text-white hover:bg-brand-red-hover border border-transparent",
    secondary:
        "bg-surface text-brand-black border border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-brand-black border border-transparent hover:bg-slate-100",
};

export default function Button({
    variant = "primary",
    className = "",
    type = "button",
    disabled,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
