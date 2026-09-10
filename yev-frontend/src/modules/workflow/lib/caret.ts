// Cross-browser helper to find the exact text-insertion point under a
// pointer position, used to drop a field placeholder exactly where the
// user releases it inside the rendered document (document-mode form designer).
export function getCaretRangeFromPoint(x: number, y: number): Range | null {
    const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };

    if (typeof doc.caretRangeFromPoint === "function") {
        return doc.caretRangeFromPoint(x, y);
    }

    if (typeof doc.caretPositionFromPoint === "function") {
        const pos = doc.caretPositionFromPoint(x, y);
        if (!pos) return null;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
    }

    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    return range;
}
