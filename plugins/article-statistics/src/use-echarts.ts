import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { ECharts, EChartsCoreOption } from "echarts/core";

export interface UseEChartsOptions {
  container: Accessor<HTMLDivElement | null>;
  option: () => EChartsCoreOption;
  init: () => ECharts | null;
}

export function useECharts(options: UseEChartsOptions) {
  const [chart, setChart] = createSignal<ECharts | null>(null);

  const resize = () => {
    chart()?.resize();
  };

  createEffect(() => {
    const el = options.container();
    if (!el) return;

    const instance = options.init();
    if (!instance) return;

    setChart(instance);
    instance.setOption(options.option(), { notMerge: true });

    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(el);

    window.addEventListener("resize", resize);

    const themeObserver = new MutationObserver(() => {
      instance.setOption(options.option(), { notMerge: true });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    onCleanup(() => {
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      instance.dispose();
      setChart(null);
    });
  });

  createEffect(() => {
    const instance = chart();
    if (!instance) return;

    instance.setOption(options.option(), { notMerge: true });
  });

  return { chart, resize };
}
