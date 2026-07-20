import { formatAuditValue, parseAuditValues } from "./audit-trail-format";

interface AuditTrailDiffViewProps {
    oldValues: string | null;
    newValues: string | null;
}

// oldValues/newValues chỉ chứa field THỰC SỰ đổi (docs §7b.1) — gộp theo tên field để hiện dạng
// "trước → sau" thay vì 2 khối JSON thô rời nhau.
export default function AuditTrailDiffView({ oldValues, newValues }: AuditTrailDiffViewProps) {
    const oldData = parseAuditValues(oldValues);
    const newData = parseAuditValues(newValues);

    if (!oldData && !newData) {
        return <p className="text-xs text-[#5e3f3a]">Không có dữ liệu thay đổi chi tiết.</p>;
    }

    const fields = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])).sort();

    if (fields.length === 0) {
        return <p className="text-xs text-[#5e3f3a]">Không có dữ liệu thay đổi chi tiết.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-xs">
                <thead>
                    <tr className="border-b border-[#e0e3e5] text-[#5e3f3a]">
                        <th className="px-3 py-1.5 font-semibold">Trường</th>
                        {oldData && <th className="px-3 py-1.5 font-semibold">Trước</th>}
                        {newData && <th className="px-3 py-1.5 font-semibold">Sau</th>}
                    </tr>
                </thead>
                <tbody>
                    {fields.map((field) => (
                        <tr key={field} className="border-b border-[#f1f5f9]">
                            <td className="px-3 py-1.5 font-semibold text-[#191c1e]">{field}</td>
                            {oldData && (
                                <td className="px-3 py-1.5 text-[#930006]">{formatAuditValue(oldData[field])}</td>
                            )}
                            {newData && (
                                <td className="px-3 py-1.5 text-emerald-700">{formatAuditValue(newData[field])}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
