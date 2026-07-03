import type { ReactNode } from "react";

interface TableProps {
    className?: string;
    children: ReactNode;
}

interface TableCellProps {
    className?: string;
    children: ReactNode;
}

export function Table({ className = "", children }: TableProps) {
    return (
        <div className={`overflow-x-auto rounded-xl bg-surface shadow-sm ${className}`}>
            <table className="min-w-full border-separate border-spacing-0 text-left">{children}</table>
        </div>
    );
}

export function TableHead({ className = "", children }: TableProps) {
    return <thead className={`bg-slate-50 text-slate-500 uppercase ${className}`}>{children}</thead>;
}

export function TableHeaderCell({ className = "", children }: TableCellProps) {
    return <th className={`px-4 py-3 text-sm font-semibold ${className}`}>{children}</th>;
}

export function TableBody({ className = "", children }: TableProps) {
    return <tbody className={`divide-y divide-slate-100 ${className}`}>{children}</tbody>;
}

export function TableRow({ className = "", children }: TableProps) {
    return <tr className={`border-b border-slate-100 hover:bg-slate-50 ${className}`}>{children}</tr>;
}

export function TableCell({ className = "", children }: TableCellProps) {
    return <td className={`px-4 py-4 text-sm text-slate-700 ${className}`}>{children}</td>;
}
