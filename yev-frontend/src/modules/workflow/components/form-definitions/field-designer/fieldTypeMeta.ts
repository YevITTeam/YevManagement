import {
    Type,
    AlignLeft,
    Hash,
    Percent,
    Calendar,
    CalendarClock,
    Clock,
    ListFilter,
    CircleDot,
    CheckSquare,
    ListChecks,
    User,
    Building2,
    Tag,
    type LucideIcon,
} from "lucide-react";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";

// Shared by palette and canvas rows so a type always shows the same icon.
export const FIELD_TYPE_META: Record<number, { icon: LucideIcon; labelKey: string }> = {
    [FieldDataType.Text]: { icon: Type, labelKey: "typeText" },
    [FieldDataType.TextArea]: { icon: AlignLeft, labelKey: "typeTextArea" },
    [FieldDataType.Number]: { icon: Hash, labelKey: "typeNumber" },
    [FieldDataType.Decimal]: { icon: Percent, labelKey: "typeDecimal" },
    [FieldDataType.Date]: { icon: Calendar, labelKey: "typeDate" },
    [FieldDataType.DateTime]: { icon: CalendarClock, labelKey: "typeDateTime" },
    [FieldDataType.Time]: { icon: Clock, labelKey: "typeTime" },
    [FieldDataType.Dropdown]: { icon: ListFilter, labelKey: "typeDropdown" },
    [FieldDataType.Radio]: { icon: CircleDot, labelKey: "typeRadio" },
    [FieldDataType.Checkbox]: { icon: CheckSquare, labelKey: "typeCheckbox" },
    [FieldDataType.MultiSelect]: { icon: ListChecks, labelKey: "typeMultiSelect" },
    [FieldDataType.Employee]: { icon: User, labelKey: "typeEmployee" },
    [FieldDataType.OrgUnit]: { icon: Building2, labelKey: "typeOrgUnit" },
    [FieldDataType.Label]: { icon: Tag, labelKey: "typeLabel" },
};

export const FIELD_TYPES_WITH_OPTIONS = new Set<number>([FieldDataType.Dropdown, FieldDataType.Radio, FieldDataType.MultiSelect]);
export const FIELD_TYPES_WITH_MINMAX = new Set<number>([FieldDataType.Number, FieldDataType.Decimal]);
export const FIELD_TYPES_WITH_MAXLENGTH = new Set<number>([FieldDataType.Text, FieldDataType.TextArea]);

export const PALETTE_ORDER: number[] = [
    FieldDataType.Text,
    FieldDataType.TextArea,
    FieldDataType.Number,
    FieldDataType.Decimal,
    FieldDataType.Date,
    FieldDataType.DateTime,
    FieldDataType.Time,
    FieldDataType.Dropdown,
    FieldDataType.Radio,
    FieldDataType.Checkbox,
    FieldDataType.MultiSelect,
    FieldDataType.Employee,
    FieldDataType.OrgUnit,
    FieldDataType.Label,
];
