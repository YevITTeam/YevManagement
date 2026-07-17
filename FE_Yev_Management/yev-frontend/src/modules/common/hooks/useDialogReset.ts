"use client";

import { useState } from "react";

// Pattern chuẩn để reset field trong dialog Form mỗi khi mở lại (isOpen) hoặc đổi bản ghi đang sửa
// (initial) — xem CLAUDE.md "Pattern reset Form dialog". Thay cho `useEffect(() => { if (isOpen)
// setValues(...) }, [isOpen, initial])` (cách cũ, vi phạm `react-hooks/set-state-in-effect`), hook
// này gọi `onReset` NGAY TRONG RENDER khi phát hiện `isOpen`/`initial` vừa đổi — đúng pattern
// "adjusting state when a prop changes" mà React chính thức khuyến khích thay effect
// (xem https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
export function useDialogReset<TInitial>(isOpen: boolean, initial: TInitial, onReset: (initial: TInitial) => void) {
    const [snapshot, setSnapshot] = useState({ isOpen, initial });
    if (snapshot.isOpen !== isOpen || (isOpen && snapshot.initial !== initial)) {
        setSnapshot({ isOpen, initial });
        if (isOpen) onReset(initial);
    }
}
