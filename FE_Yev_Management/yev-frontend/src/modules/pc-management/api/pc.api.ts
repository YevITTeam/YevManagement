import { api } from "@/lib/client";

export const PcApi = {
    getPcs: () => api.get("/pc-management/pcs"),
};
