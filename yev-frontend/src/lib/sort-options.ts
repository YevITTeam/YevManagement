// Vietnamese A–Z; numeric keeps "Ca 2" before "Ca 10".
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

export function sortByLabel<T extends { label: string }>(options: T[]): T[] {
    return [...options].sort((a, b) => collator.compare(a.label, b.label));
}
