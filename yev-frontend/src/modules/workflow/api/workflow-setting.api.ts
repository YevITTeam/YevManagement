import { api } from "@/lib/client";
import type { WorkflowSettingDto, UpdateWorkflowSettingDto } from "@/modules/workflow/types/workflow-setting.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINT = "/Workflow/WorkflowSetting";

export const WorkflowSettingApi = {
    get: async () => {
        const response = await api.get<ApiResponse<WorkflowSettingDto>>(ENDPOINT);
        return response.data;
    },

    update: async (data: UpdateWorkflowSettingDto) => {
        const response = await api.put<ApiResponse<WorkflowSettingDto>>(ENDPOINT, data);
        return response.data;
    },
};
