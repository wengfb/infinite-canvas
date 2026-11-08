import { Button, Select } from "antd";
import { Cpu, Layers, RefreshCw } from "lucide-react";

import type { ModelPickerProps } from "@/components/model-picker";
import { cn } from "@/lib/utils";
import { decodeChannelModel, encodeChannelModel } from "@/stores/use-config-store";
import { usePoopiiCatalogStore } from "@/stores/use-poopii-catalog-store";

// Reuse channel-qualified model values so every node retains its own group/model.
export function PoopiiModelPicker({ config, value, onChange, fullWidth, className }: ModelPickerProps) {
    const loading = usePoopiiCatalogStore((state) => state.loading);
    const error = usePoopiiCatalogStore((state) => state.error);
    const load = usePoopiiCatalogStore((state) => state.load);
    const catalog = usePoopiiCatalogStore((state) => state.catalog);
    const selected = decodeChannelModel(value || "");
    const group = config.channels.find((channel) => channel.id === selected?.channelId);
    const groups = config.channels.map((channel) => ({ value: channel.id, label: channel.name, description: channel.name + " " + (catalog?.groups.find((entry) => entry.name === channel.group)?.description || ""), disabled: false }));
    if (selected && !group) groups.push({ value: selected.channelId, label: "原分组已不可用", description: "", disabled: true });
    const models = group?.models.map((model) => ({ value: model.name, label: model.name })) || [];

    return (
        <div className={cn("min-w-0", fullWidth ? "w-full" : className)} data-canvas-no-zoom>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-2">
                <Select
                    aria-label="生图分组"
                    placeholder="选择分组"
                    className="w-full min-w-0"
                    prefix={<Layers className="size-3.5" aria-hidden />}
                    value={selected?.channelId || undefined}
                    options={groups}
                    showSearch={{ optionFilterProp: ["label", "description"] }}
                    notFoundContent="没有匹配的分组"
                    loading={loading}
                    disabled={loading || Boolean(error)}
                    styles={{ popup: { root: { zIndex: 1200 } } }}
                    onChange={(id) => {
                        const next = config.channels.find((channel) => channel.id === id);
                        if (!next) return;
                        const model = next.models.find((item) => item.name === selected?.model) || next.models[0];
                        onChange(encodeChannelModel(id, model?.name || ""));
                    }}
                />
                <Select
                    aria-label="生图模型"
                    placeholder="选择模型"
                    className="w-full min-w-0"
                    prefix={<Cpu className="size-3.5" aria-hidden />}
                    value={models.some((model) => model.value === selected?.model) ? selected?.model : undefined}
                    options={models}
                    showSearch={{ optionFilterProp: "label" }}
                    notFoundContent={models.length ? "没有匹配的模型" : "此分组暂无可用生图模型"}
                    loading={loading}
                    disabled={loading || Boolean(error) || !group}
                    styles={{ popup: { root: { zIndex: 1200 } } }}
                    onChange={(model) => { if (group) onChange(encodeChannelModel(group.id, model)); }}
                />
                <Button type="text" icon={<RefreshCw className="size-4" />} aria-label="刷新模型列表" title="刷新模型列表" loading={loading} onClick={() => void load()} />
            </div>
            {error ? <div role="alert" className="mt-1 text-xs text-destructive">{error}</div> : null}
            {!loading && !error && (!group || !models.length) ? <output className="mt-1 block text-xs text-muted-foreground">此分组暂无可用生图模型，请切换分组</output> : null}
        </div>
    );
}
