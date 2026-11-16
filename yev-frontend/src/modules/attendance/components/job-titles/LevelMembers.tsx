"use client";

import { Mail, MailX } from "lucide-react";

import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { PersonRow, addPersonRowClassName, addPersonTriggerClassName, peopleListClassName, personButtonClassName, personMessageClassName } from "./StepHolders";

export interface LevelMembersLabels {
    noMembers: string;
    removeMember: string;
    addPlaceholder: string;
    receivesMailOn: string;
    receivesMailOff: string;
}

interface LevelMember {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    receivesMail: boolean;
}

export default function LevelMembers({
    members,
    currentGroupName,
    addOptions,
    onAdd,
    onRemove,
    onToggleMail,
    labels,
    readOnly = false,
}: {
    members: LevelMember[];
    currentGroupName?: string;
    addOptions: SelectOption[];
    onAdd: (employeeId: number) => void;
    onRemove: (employeeId: number) => void;
    onToggleMail: (employeeId: number) => void;
    labels: LevelMembersLabels;
    readOnly?: boolean;
}) {
    return (
        <ul className={peopleListClassName}>
            {members.length === 0 && <li className={personMessageClassName}>{labels.noMembers}</li>}
            {members.map((member) => (
                <PersonRow
                    key={member.employeeId}
                    name={`${member.lastName} ${member.firstName}`}
                    code={member.employeeCode}
                    badge={member.groupNameVn !== currentGroupName ? member.groupNameVn : null}
                    onRemove={readOnly ? undefined : () => onRemove(member.employeeId)}
                    removeLabel={labels.removeMember}
                >
                    <button
                        type="button"
                        onClick={() => onToggleMail(member.employeeId)}
                        disabled={readOnly}
                        title={member.receivesMail ? labels.receivesMailOn : labels.receivesMailOff}
                        aria-label={member.receivesMail ? labels.receivesMailOn : labels.receivesMailOff}
                        aria-pressed={member.receivesMail}
                        className={`${personButtonClassName} hover:bg-[#f2f4f6] disabled:cursor-default disabled:hover:bg-transparent ${member.receivesMail ? "text-[#191c1e]" : "text-[#8a8f94]"}`}
                    >
                        {member.receivesMail ? <Mail size={13} /> : <MailX size={13} />}
                    </button>
                </PersonRow>
            ))}
            {!readOnly && (
                <li className={addPersonRowClassName}>
                    <SearchableSelect
                        options={addOptions}
                        value=""
                        onChange={(value) => value !== "" && onAdd(value)}
                        placeholder={labels.addPlaceholder}
                        triggerClassName={addPersonTriggerClassName}
                    />
                </li>
            )}
        </ul>
    );
}
