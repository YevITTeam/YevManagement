"use client";

import { useTranslations } from "next-intl";

import { Tabs } from "@/components/ui/Tabs";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";
import OrgLevelList from "@/modules/workflow/components/org-levels/OrgLevelList";
import JobTitleList from "@/modules/workflow/components/job-titles/JobTitleList";

type SettingsTab = "levels" | "jobTitles";

export default function OrgSettingsPage() {
    const t = useTranslations("Workflow.OrgSettings");
    const [activeTab, setActiveTab] = usePersistedTab<SettingsTab>("workflow-org-settings-tab", ["levels", "jobTitles"], "levels");

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
                </div>
                <Tabs
                    tabs={[
                        { key: "levels", label: t("tabLevels") },
                        { key: "jobTitles", label: t("tabJobTitles") },
                    ]}
                    activeKey={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            {activeTab === "levels" ? <OrgLevelList embedded /> : <JobTitleList embedded />}
        </div>
    );
}
