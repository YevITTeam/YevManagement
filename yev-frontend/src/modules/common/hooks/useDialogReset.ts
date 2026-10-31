"use client";

import { useState } from "react";

// Resets dialog fields during render when isOpen/initial changes, avoiding setState-in-effect
// (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
export function useDialogReset<TInitial>(isOpen: boolean, initial: TInitial, onReset: (initial: TInitial) => void) {
    const [snapshot, setSnapshot] = useState({ isOpen, initial });
    if (snapshot.isOpen !== isOpen || (isOpen && snapshot.initial !== initial)) {
        setSnapshot({ isOpen, initial });
        if (isOpen) onReset(initial);
    }
}
