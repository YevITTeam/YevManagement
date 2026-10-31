"use client";

export interface AvatarStackPerson {
    id: number;
    name: string;
    code: string;
}

const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
};

export default function AvatarStack({ people, max = 4 }: { people: AvatarStackPerson[]; max?: number }) {
    if (people.length === 0) return null;
    const visible = people.slice(0, max);
    const rest = people.length - visible.length;
    return (
        <div className="flex -space-x-2">
            {visible.map((p) => (
                <div
                    key={p.id}
                    title={`${p.name} (${p.code})`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4f2] text-[10px] font-semibold text-[#e3000f] ring-2 ring-white"
                >
                    {initials(p.name)}
                </div>
            ))}
            {rest > 0 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2f4f6] text-[10px] font-semibold text-[#5e3f3a] ring-2 ring-white">
                    +{rest}
                </div>
            )}
        </div>
    );
}
