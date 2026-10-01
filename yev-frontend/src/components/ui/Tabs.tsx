interface TabItem<T extends string> {
    key: T;
    label: string;
}

interface TabsProps<T extends string> {
    tabs: TabItem<T>[];
    activeKey: T;
    onChange: (key: T) => void;
}

// Segmented/pill tab bar — controlled, keeps zero state of its own so callers keep whatever
// activeTab state they already have. Replaces the underline tab bar previously hand-rolled in
// FormDefinitionDetail.tsx.
export function Tabs<T extends string>({ tabs, activeKey, onChange }: TabsProps<T>) {
    return (
        <div role="tablist" className="inline-flex gap-1 rounded-lg bg-[#f8fafc] p-1">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeKey === tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                        activeKey === tab.key ? "bg-white text-[#191c1e] shadow-sm" : "text-[#5e3f3a] hover:text-[#191c1e]"
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
