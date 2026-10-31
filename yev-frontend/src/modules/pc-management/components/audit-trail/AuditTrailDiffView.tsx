import { formatAuditValue, parseAuditValues, parseBulkAuditValues } from "./audit-trail-format";

interface AuditTrailDiffViewProps {
    oldValues: string | null;
    newValues: string | null;
    // >1 = one log row for several merged records; newValues is then AuditTrailBulkValuesDto (recordNames), not a field diff.
    affectedCount?: number;
}

// BE builds recordName as "Label (CODE)", e.g. "192.168.1.5 (PC-001)"; unmatched names stay whole.
function splitRecordName(name: string): { label: string; code: string | null } {
    const match = name.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (match) return { label: match[1].trim(), code: match[2].trim() };
    return { label: name, code: null };
}

// old/new values hold only changed fields; merge them by field name into before -> after rows.
export default function AuditTrailDiffView({ oldValues, newValues, affectedCount = 1 }: AuditTrailDiffViewProps) {
    if (affectedCount > 1) {
        // Only bulk Create/Update use the recordNames shape (Pascal or camelCase keys); bulk Delete still logs a normal diff.
        const bulk = parseBulkAuditValues(newValues);
        if (bulk && bulk.recordNames.length > 0) {
            const hiddenCount = bulk.affectedCount - bulk.recordNames.length;
            return (
                <div className="rounded-lg border border-[#e0e3e5] bg-white text-xs text-[#191c1e]">
                    <div className="flex flex-wrap items-center gap-2 border-b border-[#f1f5f9] px-4 py-2.5">
                        <span className="font-semibold text-[#191c1e]">Thao tác hàng loạt</span>
                        <span className="shrink-0 rounded-full border border-[#cfe0fb] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                            {bulk.affectedCount} bản ghi
                        </span>
                        {hiddenCount > 0 && (
                            <span className="text-[10px] text-[#8a8f94]">(hiển thị {bulk.recordNames.length} đầu tiên)</span>
                        )}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                            {bulk.recordNames.map((name, index) => {
                                const { label, code } = splitRecordName(name);
                                return (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 rounded-md border border-[#f1f5f9] bg-[#f8fafc] px-2 py-1.5"
                                        title={name}
                                    >
                                        <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-[#8a8f94]">
                                            {index + 1}
                                        </span>
                                        {code && (
                                            <span className="shrink-0 rounded border border-[#e0e3e5] bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#191c1e]">
                                                {code}
                                            </span>
                                        )}
                                        <span className="truncate text-[#5e3f3a]">{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {bulk.truncated && hiddenCount > 0 && (
                        <p className="border-t border-[#f1f5f9] px-4 py-2 text-[#5e3f3a]">
                            ... và {hiddenCount} bản ghi khác không hiển thị.
                        </p>
                    )}
                </div>
            );
        }
    }

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
