import { create } from "zustand";

import { requestPoopiiCatalog, type PoopiiImageCatalog } from "@/services/api/poopii";

type PoopiiCatalogState = {
    enabled: boolean;
    catalog: PoopiiImageCatalog | null;
    loading: boolean;
    error: string;
    load: () => Promise<void>;
};

// The host catalog is session-scoped and never replaces the standalone API configuration.
export const usePoopiiCatalogStore = create<PoopiiCatalogState>((set, get) => ({
    enabled: false,
    catalog: null,
    loading: false,
    error: "",
    load: async () => {
        if (get().loading) return;
        set({ enabled: true, loading: true, error: "" });
        try {
            set({ catalog: await requestPoopiiCatalog(), loading: false });
        } catch (error) {
            set({ catalog: null, loading: false, error: error instanceof Error ? error.message : "模型列表加载失败" });
        }
    },
}));
