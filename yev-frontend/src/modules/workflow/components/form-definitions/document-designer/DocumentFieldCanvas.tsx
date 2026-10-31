"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { useTranslations } from "next-intl";
import { getCaretRangeFromPoint } from "@/modules/workflow/lib/caret";
import { type EditableField, createDefaultField } from "../field-designer/editableField";
import { FIELD_TYPE_META } from "../field-designer/fieldTypeMeta";
import { DOCUMENT_FIELD_TYPE_DRAG_KEY } from "./DocumentFieldPalette";
import type { FieldDataType } from "@/modules/workflow/types/form-field.dto";

const MOVE_FIELD_DRAG_KEY = "application/x-workflow-move-field-key";

export interface DocumentFieldCanvasHandle {
    getHtml: () => string;
    // Document order becomes SortOrder on save, since this mode has no separate sortable list.
    getOrderedFieldKeys: () => string[];
}

export type DocumentCanvasInitialContent = { type: "html"; html: string } | { type: "docx"; bytes: ArrayBuffer };

interface DocumentFieldCanvasProps {
    initialContent: DocumentCanvasInitialContent;
    fields: EditableField[];
    onFieldsChange: (fields: EditableField[]) => void;
    onFieldClick: (clientId: string) => void;
}

// The document is written into the DOM once and mutated imperatively on drop;
// re-rendering from React state would lose the caret position.
const DocumentFieldCanvas = forwardRef<DocumentFieldCanvasHandle, DocumentFieldCanvasProps>(function DocumentFieldCanvas(
    { initialContent, fields, onFieldsChange, onFieldClick },
    ref
) {
    const t = useTranslations("Workflow.FormDefinition");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const initializedKeyRef = useRef<string | ArrayBuffer | null>(null);
    const fieldsRef = useRef(fields);
    const [isDragOver, setIsDragOver] = useState(false);

    useImperativeHandle(ref, () => ({
        getHtml: () => containerRef.current?.innerHTML ?? "",
        getOrderedFieldKeys: () =>
            Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-field-key]") ?? []).map(
                (el) => el.getAttribute("data-field-key") ?? ""
            ),
    }));

    useEffect(() => {
        fieldsRef.current = fields;
    }, [fields]);

    useEffect(() => {
        if (!containerRef.current) return;

        if (initialContent.type === "html") {
            if (initializedKeyRef.current !== initialContent.html) {
                containerRef.current.innerHTML = initialContent.html;
                initializedKeyRef.current = initialContent.html;
            }
            return;
        }

        if (initializedKeyRef.current === initialContent.bytes) return;
        initializedKeyRef.current = initialContent.bytes;
        renderAsync(initialContent.bytes, containerRef.current).catch((err) => {
            console.error("docx-preview render failed", err);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContent.type === "html" ? initialContent.html : initialContent.bytes]);

    // Keep placeholder labels in sync with field data so FormFieldEditDialog edits show in the text.
    useEffect(() => {
        if (!containerRef.current) return;
        for (const field of fields) {
            const span = containerRef.current.querySelector<HTMLElement>(`[data-field-key="${field.fieldKey}"]`);
            if (span) {
                span.textContent = `[[${field.labelVn}]]`;
                span.setAttribute("data-field-type", String(field.dataType));
                span.draggable = true;
            }
        }
    }, [fields]);

    // The canvas is contentEditable, so placeholders can vanish by typing; resync fields with what's left in the DOM.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new MutationObserver(() => {
            const presentKeys = new Set(
                Array.from(container.querySelectorAll<HTMLElement>("[data-field-key]")).map((el) => el.getAttribute("data-field-key"))
            );
            const stillMissing = fieldsRef.current.some((f) => !presentKeys.has(f.fieldKey));
            if (stillMissing) {
                onFieldsChange(fieldsRef.current.filter((f) => presentKeys.has(f.fieldKey)));
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function createPlaceholder(field: EditableField) {
        const span = document.createElement("span");
        span.className = "field-placeholder";
        span.setAttribute("contenteditable", "false");
        span.setAttribute("data-field-key", field.fieldKey);
        span.setAttribute("data-field-type", String(field.dataType));
        span.draggable = true;
        span.textContent = `[[${field.labelVn}]]`;
        return span;
    }

    function resolveDropRange(clientX: number, clientY: number, excludeElement?: HTMLElement) {
        const container = containerRef.current;
        if (!container) return null;

        const range = getCaretRangeFromPoint(clientX, clientY);
        if (!range || !container.contains(range.startContainer)) return null;

        const hostElement = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as HTMLElement);
        const existingPlaceholder = hostElement?.closest<HTMLElement>(".field-placeholder");

        if (existingPlaceholder && existingPlaceholder === excludeElement) return null;

        if (existingPlaceholder) {
            range.setStartAfter(existingPlaceholder);
            range.collapse(true);
        }

        return range;
    }

    function handleMoveDrop(fieldKey: string, clientX: number, clientY: number) {
        const container = containerRef.current;
        if (!container) return;
        const movingSpan = container.querySelector<HTMLElement>(`[data-field-key="${fieldKey}"]`);
        if (!movingSpan) return;

        const range = resolveDropRange(clientX, clientY, movingSpan);
        if (!range) return;

        movingSpan.remove();
        range.insertNode(movingSpan);
    }

    function handleNewFieldDrop(dataType: FieldDataType, clientX: number, clientY: number) {
        const range = resolveDropRange(clientX, clientY);
        if (!range) return;

        const defaultLabel = t(FIELD_TYPE_META[dataType]?.labelKey ?? "");
        const newField = createDefaultField(dataType, fieldsRef.current, defaultLabel);
        const span = createPlaceholder(newField);
        range.insertNode(span);

        onFieldsChange([...fieldsRef.current, newField]);
        onFieldClick(newField.clientId);
    }

    function hideDropIndicator() {
        if (indicatorRef.current) indicatorRef.current.style.opacity = "0";
    }

    function updateDropIndicator(clientX: number, clientY: number) {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const wrapper = wrapperRef.current;
            const indicator = indicatorRef.current;
            const container = containerRef.current;
            if (!wrapper || !indicator || !container) return;

            const range = getCaretRangeFromPoint(clientX, clientY);
            if (!range || !container.contains(range.startContainer)) {
                indicator.style.opacity = "0";
                return;
            }

            let rect: DOMRect | undefined = range.getClientRects()[0];
            if (!rect || (rect.width === 0 && rect.height === 0)) {
                const hostElement = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as HTMLElement);
                rect = hostElement?.getBoundingClientRect();
            }
            if (!rect || (rect.width === 0 && rect.height === 0)) {
                indicator.style.opacity = "0";
                return;
            }

            const wrapperRect = wrapper.getBoundingClientRect();
            indicator.style.opacity = "1";
            indicator.style.left = `${rect.left - wrapperRect.left + wrapper.scrollLeft}px`;
            indicator.style.top = `${rect.top - wrapperRect.top + wrapper.scrollTop}px`;
            indicator.style.height = `${Math.max(rect.height, 16)}px`;
        });
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setIsDragOver(false);
        hideDropIndicator();
        if (!containerRef.current) return;

        const moveFieldKey = e.dataTransfer.getData(MOVE_FIELD_DRAG_KEY);
        if (moveFieldKey) {
            handleMoveDrop(moveFieldKey, e.clientX, e.clientY);
            return;
        }

        const rawDataType = e.dataTransfer.getData(DOCUMENT_FIELD_TYPE_DRAG_KEY);
        if (!rawDataType) return;
        handleNewFieldDrop(Number(rawDataType) as FieldDataType, e.clientX, e.clientY);
    }

    function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
        const target = (e.target as HTMLElement).closest<HTMLElement>("[data-field-key]");
        if (!target) return;
        const fieldKey = target.getAttribute("data-field-key");
        const field = fieldsRef.current.find((f) => f.fieldKey === fieldKey);
        if (field) onFieldClick(field.clientId);
    }

    function handleContainerDragStart(e: React.DragEvent<HTMLDivElement>) {
        const target = (e.target as HTMLElement).closest<HTMLElement>(".field-placeholder");
        if (!target) return;
        const fieldKey = target.getAttribute("data-field-key");
        if (!fieldKey) return;
        e.dataTransfer.setData(MOVE_FIELD_DRAG_KEY, fieldKey);
        e.dataTransfer.effectAllowed = "move";
    }

    return (
        <div
            ref={wrapperRef}
            className={`relative overflow-x-auto rounded-xl border-2 bg-white shadow-sm transition-colors ${
                isDragOver ? "border-[#e3000f]/60 bg-[#fff4f2]" : "border-transparent"
            }`}
        >
            <div
                ref={containerRef}
                contentEditable
                suppressContentEditableWarning
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                    updateDropIndicator(e.clientX, e.clientY);
                }}
                onDragLeave={() => {
                    setIsDragOver(false);
                    hideDropIndicator();
                }}
                onDrop={handleDrop}
                onClick={handleContainerClick}
                onDragStart={handleContainerDragStart}
                className="workflow-document-canvas min-h-[600px] p-10 text-neutral-900 outline-none"
            />
            <div ref={indicatorRef} className="pointer-events-none absolute w-0.5 rounded-full bg-[#e3000f] opacity-0 transition-opacity" />
        </div>
    );
});

export default DocumentFieldCanvas;
