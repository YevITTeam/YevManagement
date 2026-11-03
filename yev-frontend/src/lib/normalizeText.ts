// Lower-case, accent-free form used for matching, so "nguyen van" matches the accented name.
export function normalizeText(value: string) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d");
}
