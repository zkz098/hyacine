import { createSignal } from "solid-js";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TitleComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import { useECharts } from "./use-echarts";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

type ChartOption = ComposeOption<
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | BarSeriesOption
  | LineSeriesOption
>;

export interface CountItem {
  name: string;
  count: number;
}

export interface MonthlyPostCount {
  label: string;
  count: number;
}

export interface ChartLabels {
  monthlyPosts?: string;
  postCount?: string;
  categoryDistribution?: string;
  tagDistribution?: string;
}

export interface ArticleStatisticsChartsProps {
  monthlyPostCounts?: MonthlyPostCount[];
  categoryCounts?: CountItem[];
  tagCounts?: CountItem[];
  chartLabels?: ChartLabels;
}

function resolveThemeColor(token: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function initEChart(element: HTMLDivElement): echarts.ECharts {
  return echarts.init(element);
}

export default function ArticleStatisticsCharts(props: ArticleStatisticsChartsProps) {
  const labels = () => ({
    monthlyPosts: props.chartLabels?.monthlyPosts ?? "文章发布趋势",
    postCount: props.chartLabels?.postCount ?? "文章篇数",
    categoryDistribution: props.chartLabels?.categoryDistribution ?? "文章分类分布",
    tagDistribution: props.chartLabels?.tagDistribution ?? "文章标签分布",
  });

  const [monthlyChartElement, setMonthlyChartElement] = createSignal<HTMLDivElement | null>(null);
  const [categoryChartElement, setCategoryChartElement] = createSignal<HTMLDivElement | null>(null);
  const [tagChartElement, setTagChartElement] = createSignal<HTMLDivElement | null>(null);

  useECharts({
    container: monthlyChartElement,
    option: createMonthlyOption,
    init: () => (monthlyChartElement() ? initEChart(monthlyChartElement()!) : null),
  });
  useECharts({
    container: categoryChartElement,
    option: createCategoryOption,
    init: () => (categoryChartElement() ? initEChart(categoryChartElement()!) : null),
  });
  useECharts({
    container: tagChartElement,
    option: createTagOption,
    init: () => (tagChartElement() ? initEChart(tagChartElement()!) : null),
  });

  function createMonthlyOption(): ChartOption {
    const monthlyList = props.monthlyPostCounts ?? [];
    const lineColor = resolveThemeColor("--color-purple", "#9333ea");
    const pointColor = resolveThemeColor("--color-red", "#ef4444");
    const titleColor = resolveThemeColor("--color-purple", "#9333ea");
    const xAxisColor = resolveThemeColor("--color-aqua", "#06b6d4");
    const yAxisColor = resolveThemeColor("--color-purple", "#9333ea");
    const axisLineColor = resolveThemeColor("--grey-4", "#cccccc");
    const splitLineColor = resolveThemeColor("--grey-3", "#e5e5e5");
    const tooltipBg = resolveThemeColor("--grey-1", "#ffffff");
    const tooltipText = resolveThemeColor("--grey-7", "#333333");

    return {
      title: {
        text: labels().monthlyPosts,
        left: "center",
        textStyle: { color: titleColor, fontWeight: 600, fontSize: 16 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: lineColor,
        textStyle: { color: tooltipText },
      },
      grid: { left: 36, right: 24, top: 56, bottom: 28 },
      xAxis: {
        type: "category",
        data: monthlyList.map((item) => item.label),
        axisLabel: {
          color: xAxisColor,
          rotate: monthlyList.length > 10 ? 35 : 0,
        },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: yAxisColor },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: labels().postCount,
          type: "line",
          smooth: true,
          data: monthlyList.map((item) => item.count),
          lineStyle: { width: 3, color: lineColor },
          itemStyle: { color: pointColor, opacity: 1 },
          areaStyle: {
            color: lineColor,
            opacity: 0.2,
          },
          emphasis: {
            focus: "none",
            itemStyle: { opacity: 1 },
            lineStyle: { opacity: 1 },
            areaStyle: { opacity: 0.3 },
          },
        },
      ],
    };
  }

  function createCategoryOption(): ChartOption {
    const topCategories = (props.categoryCounts ?? []).slice(0, 10);
    const palette = [
      resolveThemeColor("--color-red", "#ef4444"),
      resolveThemeColor("--color-orange", "#f97316"),
      resolveThemeColor("--color-yellow", "#eab308"),
      resolveThemeColor("--color-pink", "#ec4899"),
      resolveThemeColor("--color-purple", "#9333ea"),
      resolveThemeColor("--color-blue", "#3b82f6"),
      resolveThemeColor("--color-aqua", "#06b6d4"),
      resolveThemeColor("--color-green", "#22c55e"),
    ];
    const titleColor = resolveThemeColor("--color-red", "#ef4444");
    const xAxisColor = resolveThemeColor("--color-orange", "#f97316");
    const yAxisColor = resolveThemeColor("--color-pink", "#ec4899");
    const axisLineColor = resolveThemeColor("--grey-4", "#cccccc");
    const splitLineColor = resolveThemeColor("--grey-3", "#e5e5e5");
    const tooltipBg = resolveThemeColor("--grey-1", "#ffffff");
    const tooltipText = resolveThemeColor("--grey-7", "#333333");

    return {
      color: palette,
      title: {
        text: labels().categoryDistribution,
        left: "center",
        textStyle: { color: titleColor, fontWeight: 600, fontSize: 16 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tooltipBg,
        borderColor: resolveThemeColor("--color-orange", "#f97316"),
        textStyle: { color: tooltipText },
      },
      grid: { left: 56, right: 16, top: 56, bottom: 22 },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: xAxisColor },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: "category",
        data: topCategories.map((item) => item.name),
        axisLabel: { color: yAxisColor },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      series: [
        {
          name: labels().postCount,
          type: "bar",
          data: topCategories.map((item) => item.count),
          barWidth: "52%",
          colorBy: "data",
          itemStyle: { borderRadius: [0, 6, 6, 0], opacity: 1 },
          emphasis: { focus: "none", itemStyle: { opacity: 1 } },
        },
      ],
    };
  }

  function createTagOption(): ChartOption {
    const topTags = (props.tagCounts ?? []).slice(0, 16);
    const palette = [
      resolveThemeColor("--color-blue", "#3b82f6"),
      resolveThemeColor("--color-aqua", "#06b6d4"),
      resolveThemeColor("--color-green", "#22c55e"),
      resolveThemeColor("--color-yellow", "#eab308"),
      resolveThemeColor("--color-orange", "#f97316"),
      resolveThemeColor("--color-red", "#ef4444"),
      resolveThemeColor("--color-pink", "#ec4899"),
      resolveThemeColor("--color-purple", "#9333ea"),
    ];
    const titleColor = resolveThemeColor("--color-blue", "#3b82f6");
    const xAxisColor = resolveThemeColor("--color-aqua", "#06b6d4");
    const yAxisColor = resolveThemeColor("--color-blue", "#3b82f6");
    const axisLineColor = resolveThemeColor("--grey-4", "#cccccc");
    const splitLineColor = resolveThemeColor("--grey-3", "#e5e5e5");
    const tooltipBg = resolveThemeColor("--grey-1", "#ffffff");
    const tooltipText = resolveThemeColor("--grey-7", "#333333");

    return {
      color: palette,
      title: {
        text: labels().tagDistribution,
        left: "center",
        textStyle: { color: titleColor, fontWeight: 600, fontSize: 16 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tooltipBg,
        borderColor: resolveThemeColor("--color-blue", "#3b82f6"),
        textStyle: { color: tooltipText },
      },
      grid: { left: 28, right: 24, top: 56, bottom: 36 },
      xAxis: {
        type: "category",
        data: topTags.map((item) => item.name),
        axisLabel: {
          color: xAxisColor,
          rotate: topTags.length > 8 ? 28 : 0,
        },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: yAxisColor },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: labels().postCount,
          type: "bar",
          data: topTags.map((item) => item.count),
          barWidth: "56%",
          colorBy: "data",
          itemStyle: { borderRadius: [6, 6, 0, 0], opacity: 1 },
          emphasis: { focus: "none", itemStyle: { opacity: 1 } },
        },
      ],
    };
  }

  return (
    <section class="hyacine-statistics-charts chart-section">
      <div class="chart-card">
        <div ref={setMonthlyChartElement} class="chart-canvas"></div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <div ref={setCategoryChartElement} class="chart-canvas"></div>
        </div>
        <div class="chart-card">
          <div ref={setTagChartElement} class="chart-canvas"></div>
        </div>
      </div>
    </section>
  );
}
