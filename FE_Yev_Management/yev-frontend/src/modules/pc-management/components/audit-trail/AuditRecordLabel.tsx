"use client";

import { useEffect, useState } from "react";

import { auditRecordLabelResolvers } from "./audit-trail-record-label";

interface AuditRecordLabelProps {
    tableName: string;
    recordId: number;
}

// Hiện thêm tên gọi thật của đối tượng bị thao tác bên cạnh recordId thô (vd tableName="IpAddress"
// → hiện đúng chuỗi IP đã bị sửa) cho các bảng đã đăng ký resolver — bảng chưa đăng ký thì không
// hiện gì thêm, tránh gọi API thừa.
export default function AuditRecordLabel({ tableName, recordId }: AuditRecordLabelProps) {
    const [label, setLabel] = useState<string | null>(null);

    const resetKey = `${tableName}|${recordId}`;
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    if (prevResetKey !== resetKey) {
        setPrevResetKey(resetKey);
        setLabel(null);
    }

    useEffect(() => {
        const resolver = auditRecordLabelResolvers[tableName];
        if (!resolver) return;
        let isCancelled = false;
        resolver(recordId)
            .then((result) => {
                if (!isCancelled) setLabel(result);
            })
            .catch(() => {
                // Không tra được nhãn — vẫn hiện recordId thô như bình thường, bỏ qua lỗi.
            });

        return () => {
            isCancelled = true;
        };
    }, [tableName, recordId]);

    if (!label) return null;

    return <span className="ml-1.5 text-xs font-normal text-[#5e3f3a]">({label})</span>;
}
