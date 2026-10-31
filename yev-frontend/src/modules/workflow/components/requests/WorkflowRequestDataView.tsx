import parse, { Element, type HTMLReactParserOptions } from "html-react-parser";
import type { FormSchemaSnapshot, JsonValue } from "@/modules/workflow/types/workflow-request.dto";
import { FieldDataType } from "@/modules/workflow/types/form-field.dto";

interface WorkflowRequestDataViewProps {
    schema: FormSchemaSnapshot;
    data: Record<string, JsonValue>;
    /** true = print layout: no borders/backgrounds, text only */
    printMode?: boolean;
}

interface OptionRow {
    value: string;
    label: string;
}

function parseOptions(json: string | null): OptionRow[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed.map((x) => ({ value: String(x.value ?? ""), label: String(x.label ?? "") }));
    } catch {
        // ignore, treat as no options
    }
    return [];
}

// print: needs md: too because the print width (A4 ~718px) is below the md breakpoint,
// so md:col-span-* never applies when printing.
const COLUMN_SPAN_CLASS: Record<number, string> = {
    1: "col-span-3 md:col-span-1 print:col-span-1",
    2: "col-span-3 md:col-span-2 print:col-span-2",
    3: "col-span-3",
};

function formatDate(v: string) {
    const [y, m, d] = v.split("-");
    return y && m && d ? `${d}/${m}/${y}` : v;
}

function formatDateTime(v: string) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatValue(dataType: number, raw: JsonValue, optionsJson: string | null): string {
    if (raw === null || raw === undefined || raw === "") return "—";

    switch (dataType) {
        case FieldDataType.Checkbox:
            return raw === true ? "Có" : "Không";
        case FieldDataType.Date:
            return typeof raw === "string" ? formatDate(raw) : "—";
        case FieldDataType.DateTime:
            return typeof raw === "string" ? formatDateTime(raw) : "—";
        case FieldDataType.Dropdown:
        case FieldDataType.Radio: {
            if (typeof raw !== "string") return "—";
            const options = parseOptions(optionsJson);
            return options.find((o) => o.value === raw)?.label ?? raw;
        }
        case FieldDataType.MultiSelect: {
            if (!Array.isArray(raw)) return "—";
            const options = parseOptions(optionsJson);
            return raw.map((v) => options.find((o) => o.value === v)?.label ?? String(v)).join(", ") || "—";
        }
        case FieldDataType.Employee:
        case FieldDataType.OrgUnit: {
            if (raw && typeof raw === "object" && !Array.isArray(raw) && "name" in raw) {
                const code = "code" in raw && raw.code ? ` (${String(raw.code)})` : "";
                return `${String(raw.name)}${code}`;
            }
            return "—";
        }
        case FieldDataType.Number:
        case FieldDataType.Decimal:
            return typeof raw === "number" ? raw.toLocaleString("vi-VN") : "—";
        default:
            return typeof raw === "string" ? raw : String(raw);
    }
}

// Hidden fields were already nulled on submit, so no condition re-evaluation is needed here.
export default function WorkflowRequestDataView({ schema, data, printMode }: WorkflowRequestDataViewProps) {
    // Document mode: layout snapshotted at submit; each <span data-field-key> is replaced with its value.
    if (schema.layoutHtml) {
        const fieldsByKey = new Map(schema.fields.map((f) => [f.fieldKey, f]));
        const options: HTMLReactParserOptions = {
            replace: (domNode) => {
                if (!(domNode instanceof Element) || domNode.name !== "span") return undefined;
                const fieldKey = domNode.attribs?.["data-field-key"];
                if (!fieldKey) return undefined;
                const field = fieldsByKey.get(fieldKey);
                if (!field || field.dataType === FieldDataType.Label) return undefined;

                const formatted = formatValue(field.dataType, data[field.fieldKey] ?? null, field.optionsJson);
                return (
                    <span className="font-semibold text-[#191c1e] underline decoration-dotted underline-offset-2">
                        {formatted}
                    </span>
                );
            },
        };
        return <div className="workflow-document-canvas text-sm">{parse(schema.layoutHtml, options)}</div>;
    }

    const sortedFields = [...schema.fields].sort((a, b) => a.sortOrder - b.sortOrder);

    return (
        <div className={`grid grid-cols-3 gap-4 ${printMode ? "gap-y-3" : ""}`}>
            {sortedFields.map((field) => (
                <div key={field.fieldKey} className={`${COLUMN_SPAN_CLASS[field.columnSpan] ?? COLUMN_SPAN_CLASS[1]} break-inside-avoid`}>
                    {field.dataType === FieldDataType.Label ? (
                        <p className="text-sm font-semibold text-[#191c1e]">{field.labelVn}</p>
                    ) : (
                        <>
                            <p className="text-[11px] font-semibold uppercase text-[#8a8f94]">{field.labelVn}</p>
                            <p className="mt-0.5 text-sm text-[#191c1e]">{formatValue(field.dataType, data[field.fieldKey] ?? null, field.optionsJson)}</p>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
