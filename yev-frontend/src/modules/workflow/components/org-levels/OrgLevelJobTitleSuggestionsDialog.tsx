"use client";

import { useState } from "react";
import { X, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface OrgLevelJobTitleSuggestionsDialogProps {
    orgLevel: OrgLevelDto;
    onClose: () => void;
}

// Suggested (not enforced) job titles for units at this level; list order is SortOrder, first item is the default pre-selection.
export default function OrgLevelJobTitleSuggestionsDialog({ orgLevel, onClose }: OrgLevelJobTitleSuggestionsDialogProps) {
    const t = useTranslations("Workflow.OrgLevel");
    const tCommon = useTranslations("Common");

    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { isLoading, error } = useFetchEffect(
        async () => {
            const [titles, suggestions] = await Promise.all([
                JobTitleApi.getAllJobTitles(),
                OrgLevelApi.getJobTitleSuggestions(orgLevel.id),
            ]);
            return { titles, suggestions };
        },
        [orgLevel.id],
        (result) => {
            setJobTitles(result.titles);
            setSelectedIds(result.suggestions.sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.jobTitleId));
        },
        t("jobTitleSuggestionsLoadError"),
        (message) => toast.error(message)
    );

    const addJobTitle = (jobTitleId: number) => {
        setSelectedIds((current) => [...current, jobTitleId]);
    };

    const removeJobTitle = (jobTitleId: number) => {
        setSelectedIds((current) => current.filter((id) => id !== jobTitleId));
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        setSelectedIds((current) => {
            const next = [...current];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveDown = (index: number) => {
        setSelectedIds((current) => {
            if (index === current.length - 1) return current;
            const next = [...current];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await OrgLevelApi.replaceJobTitleSuggestions(orgLevel.id, { jobTitleIds: selectedIds });
            toast.success(t("jobTitleSuggestionsSaveSuccess"));
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("jobTitleSuggestionsSaveError")));
        } finally {
            setIsSaving(false);
        }
    };

    const jobTitleById = new Map(jobTitles.map((jt) => [jt.id, jt]));
    const availableJobTitles = jobTitles.filter((jt) => !selectedIds.includes(jt.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isSaving && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="org-level-job-title-suggestions-title"
                className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 id="org-level-job-title-suggestions-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("jobTitleSuggestionsTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">{orgLevel.nameVn}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSaving && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="py-10 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>
                ) : error ? (
                    <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                ) : (
                    <div className="space-y-4">

                        <div className="space-y-1.5">
                            {selectedIds.length === 0 && (
                                <p className="rounded-lg border border-dashed border-[#e0e3e5] px-3 py-4 text-center text-sm text-[#5e3f3a]">
                                    {t("jobTitleSuggestionsEmpty")}
                                </p>
                            )}
                            {selectedIds.map((jobTitleId, index) => {
                                const jt = jobTitleById.get(jobTitleId);
                                if (!jt) return null;
                                return (
                                    <div
                                        key={jobTitleId}
                                        className="flex items-center gap-2 rounded-lg border border-[#e0e3e5] px-3 py-2"
                                    >
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-[11px] font-semibold text-[#5e3f3a]">
                                            {index + 1}
                                        </span>
                                        <span className="flex-1 text-sm text-[#191c1e]">{jt.nameVn}</span>
                                        <button
                                            type="button"
                                            onClick={() => moveUp(index)}
                                            disabled={isSaving || index === 0}
                                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-30"
                                            aria-label={t("jobTitleSuggestionsMoveUp")}
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveDown(index)}
                                            disabled={isSaving || index === selectedIds.length - 1}
                                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-30"
                                            aria-label={t("jobTitleSuggestionsMoveDown")}
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeJobTitle(jobTitleId)}
                                            disabled={isSaving}
                                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#930006] hover:bg-[#fff4f2] disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {availableJobTitles.length > 0 && (
                            <div className="space-y-1.5 border-t border-[#e0e3e5] pt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("jobTitleSuggestionsAddLabel")}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableJobTitles.map((jt) => (
                                        <button
                                            key={jt.id}
                                            type="button"
                                            onClick={() => addJobTitle(jt.id)}
                                            disabled={isSaving}
                                            className="flex cursor-pointer items-center gap-1 rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                                        >
                                            <Plus className="h-3 w-3" /> {jt.nameVn}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 border-t border-[#e0e3e5] pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {tCommon("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? tCommon("processing") : tCommon("save")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
