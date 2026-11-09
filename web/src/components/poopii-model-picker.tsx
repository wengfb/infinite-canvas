import { Button, Select } from "antd";
import { Cpu, Layers, RefreshCw } from "lucide-react";

import type { ModelPickerProps } from "@/components/model-picker";
import { cn } from "@/lib/utils";
import { decodeChannelModel, encodeChannelModel } from "@/stores/use-config-store";
import { usePoopiiCatalogStore } from "@/stores/use-poopii-catalog-store";

// Reuse channel-qualified model values so every node retains its own group/model.
export function PoopiiModelPicker({ config, value, onChange, capability = "image", fullWidth, className }: ModelPickerProps) {
    const loading = usePoopiiCatalogStore((state) => state.loading);
    const error = usePoopiiCatalogStore((state) => state.error);
    const load = usePoopiiCatalogStore((state) => state.load);
    const catalog = usePoopiiCatalogStore((state) => state.catalog);
    const selected = decodeChannelModel(value || "");
    const group = config.channels.find((channel) => channel.id === selected?.channelId);
    const groups = config.channels.map((channel) => ({ value: channel.id, label: channel.name, description: channel.name + " " + (catalog?.groups.find((entry) => entry.name === channel.group)?.description || ""), disabled: false }));
    if (selected && !group) groups.push({ value: selected.channelId, label: "原分组已不可用", description: "", disabled: true });
    const models = group?.models.filter((model) => model.capability === capability).map((model) => ({ value: model.name, label: model.name })) || [];
    const label = { image: "生图", text: "文本", audio: "音频", video: "视频" }[capability];

    return (
        <div
            className={cn("min-w-0", fullWidth ? "w-full" : className)}
            data-canvas-no-zoom
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
        >
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-2">
                <Select
                    aria-label={`${label}分组`}
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
                        const available = next.models.filter((item) => item.capability === capability);
                        const model = available.find((item) => item.name === selected?.model) || available[0];
                        onChange(encodeChannelModel(id, model?.name || ""));
                    }}
                />
                <Select
                    aria-label={`${label}模型`}
                    placeholder="选择模型"
                    className="w-full min-w-0"
                    prefix={<Cpu className="size-3.5" aria-hidden />}
                    value={models.some((model) => model.value === selected?.model) ? selected?.model : undefined}
                    options={models}
                    showSearch={{ optionFilterProp: "label" }}
                    notFoundContent={models.length ? "没有匹配的模型" : `此分组暂无可用${label}模型`}
                    loading={loading}
                    disabled={loading || Boolean(error) || !group}
                    styles={{ popup: { root: { zIndex: 1200 } } }}
                    onChange={(model) => { if (group) onChange(encodeChannelModel(group.id, model)); }}
                />
                <Button type="text" icon={<RefreshCw className="size-4" />} aria-label="刷新模型列表" title="刷新模型列表" loading={loading} onClick={() => void load()} />
            </div>
            {error ? <div role="alert" className="mt-1 text-xs text-destructive">{error}</div> : null}
            {!loading && !error && (!group || !models.length) ? <output className="mt-1 block text-xs text-muted-foreground">此分组暂无可用{label}模型，请切换分组</output> : null}
        </div>
    );
}
