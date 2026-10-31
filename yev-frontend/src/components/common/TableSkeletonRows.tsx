import { Skeleton } from "@/components/ui/Skeleton";

interface TableSkeletonRowsProps {
    rows: number;
    columns: number;
}

export function TableSkeletonRows({ rows, columns }: TableSkeletonRowsProps) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[#f1f5f9]">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <td key={colIndex} className="px-4 py-3">
                            <Skeleton className="h-4 w-full max-w-40" />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
