"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import type { Member } from "../types/schedule";
import { initialsOf, memberColor } from "../lib/task";

interface MembersBarProps {
  members: Member[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export default function MembersBar({ members, onAdd, onRemove }: MembersBarProps) {
  const [name, setName] = useState("");

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  };

  return (
    <div className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-[#191c1e]">Thành viên dự án</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            placeholder="Tên thành viên..."
            className="h-9 w-52 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
          />
          <button
            onClick={handleAdd}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
          >
            <UserPlus className="h-3.5 w-3.5" /> Thêm
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 text-sm text-[#5e3f3a]">Chưa có thành viên. Thêm thành viên để giao task cho họ.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((member, index) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-2 rounded-full border border-[#e0e3e5] bg-[#f8fafc] py-1 pl-1 pr-2 text-sm text-[#191c1e]"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: memberColor(index) }}
              >
                {initialsOf(member.name)}
              </span>
              {member.name}
              <button
                onClick={() => onRemove(member.id)}
                className="cursor-pointer text-[#9aa0a6] transition hover:text-[#930006]"
                aria-label={`Xoá ${member.name}`}
                title="Xoá thành viên"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
