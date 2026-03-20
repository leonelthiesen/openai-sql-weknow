import type {
  SimplifiedChartAxisDefinition,
  SimplifiedChartDefinition,
  SimplifiedChartLegendDefinition,
  SimplifiedChartSeriesDefinition,
} from "../models/llm-structured-output.models";
import type { ExecutionData } from "../services/chat.service";

type EChartsYAxis = {
  type: "value";
  name?: string;
  position?: "left" | "right";
  min?: number;
  max?: number;
  axisLabel?: {
    formatter?: string;
  };
};

type EChartsSeries = {
  type: "bar" | "line" | "pie";
  name: string;
  yAxisIndex?: number;
  stack?: string;
  smooth?: boolean;
  label?: {
    show: boolean;
    formatter?: string;
  };
  itemStyle?: {
    color?: string;
  };
  areaStyle?: Record<string, never>;
  encode?: {
    x?: string;
    y?: string;
    itemName?: string;
    value?: string;
  };
  data?: Array<{ name: string; value: string | number | null }>;
};

export interface EChartsOptionLike {
  title: {
    text: string;
    padding: [number, number, number, number];
  };
  dataset: {
    dimensions: string[];
    source: (string | number | null)[][];
  };
  tooltip: {
    trigger: "axis" | "item";
    formatter?: string;
  };
  legend?: {
    show?: boolean;
    top?: number | string;
    right?: number | string;
    left?: number | string;
    bottom?: number | string;
    orient?: "horizontal" | "vertical";
  };
  grid?: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    containLabel?: boolean;
  };
  xAxis?: {
    type: "category";
    name?: string;
  };
  yAxis?: EChartsYAxis[];
  series: EChartsSeries[];
}

function normalizeFieldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function assertFieldExists(fieldName: string, dimensions: string[]): void {
  const normalizedFieldName = normalizeFieldName(fieldName);
  const exists = dimensions.some((item) => normalizeFieldName(item) === normalizedFieldName);

  if (!exists) {
    throw new Error(`Campo '${fieldName}' nao foi encontrado no resultado da consulta.`);
  }
}

function resolveFormatterFunction(
  formatterFunction: string | undefined,
  context: string
): string | undefined {
  if (!formatterFunction) {
    return undefined;
  }

  const normalized = formatterFunction.trim();
  const isFunctionSyntax = /^function\s*\([^)]*\)\s*\{[\s\S]*\}$/.test(normalized);

  if (!isFunctionSyntax) {
    throw new Error(
      `Formatter invalido em ${context}. Use o formato: function (...) { ... }.`
    );
  }

  return normalized;
}

function resolveLegendConfig(legend?: SimplifiedChartLegendDefinition): EChartsOptionLike["legend"] {
  const position = legend?.position ?? "bottom";

  if (position === "none") {
    return { show: false };
  }

  if (position === "right") {
    return { right: 16, top: "middle", orient: "vertical" };
  }

  if (position === "left") {
    return { left: 16, top: "middle", orient: "vertical" };
  }

  if (position === "top") {
    return { top: 10, orient: "horizontal" };
  }

  return { bottom: 10, orient: "horizontal" };
}

function buildAxisLabelFormatter(axis: SimplifiedChartAxisDefinition): string | undefined {
  const functionFormatter = resolveFormatterFunction(axis.formatterFunction, "axes[].formatterFunction");
  if (functionFormatter) {
    return functionFormatter;
  }

  const decimals = axis.decimals ?? 0;

  if (axis.format === "percent") {
    return `{value}%`;
  }

  if (axis.format === "currency") {
    const currencySymbol = axis.currencySymbol ?? "R$";
    if (decimals <= 0) {
      return `${currencySymbol} {value}`;
    }
    return `${currencySymbol} {value}`;
  }

  return undefined;
}

function buildYAxis(
  axes: SimplifiedChartAxisDefinition[] | undefined,
  series: SimplifiedChartSeriesDefinition[]
): EChartsYAxis[] {
  const requestedAxisIndexes = new Set<number>(series.map((item) => item.yAxisIndex ?? 0));

  if (axes && axes.length > 0) {
    axes.forEach((axis) => requestedAxisIndexes.add(axis.index));
  }

  const sortedIndexes = Array.from(requestedAxisIndexes).sort((a, b) => a - b);

  return sortedIndexes.map((index, orderIndex) => {
    const axisConfig = axes?.find((axis) => axis.index === index);
    const inferredPosition = orderIndex === 0 ? "left" : "right";

    return {
      type: "value",
      name: axisConfig?.name,
      position: axisConfig?.position ?? inferredPosition,
      min: axisConfig?.min,
      max: axisConfig?.max,
      axisLabel: {
        formatter: axisConfig ? buildAxisLabelFormatter(axisConfig) : undefined,
      },
    } satisfies EChartsYAxis;
  });
}

function buildSeries(chartDefinition: SimplifiedChartDefinition): EChartsSeries[] {
  if (chartDefinition.chartType === "pie") {
    const firstSeries = chartDefinition.series[0];
    if (!firstSeries) {
      throw new Error("Grafico pie requer ao menos uma serie.");
    }

    return [
      {
        type: "pie",
        name: firstSeries.name,
        encode: {
          itemName: chartDefinition.categoryField,
          value: firstSeries.field,
        },
      },
    ];
  }

  return chartDefinition.series.map((series) => {
    const isAreaSeries = series.seriesType === "area" || chartDefinition.chartType === "area";
    const defaultSeriesType: "bar" | "line" = chartDefinition.chartType === "bar" ? "bar" : "line";
    const overrideSeriesType: "bar" | "line" | undefined =
      series.seriesType === "bar" || series.seriesType === "line" ? series.seriesType : undefined;
    const baseSeriesType: "bar" | "line" = isAreaSeries
      ? "line"
      : (overrideSeriesType ?? defaultSeriesType);

    const labelFormatter = resolveFormatterFunction(
      series.labelFormatterFunction,
      "series[].labelFormatterFunction"
    );
    const showLabel = series.showLabels ?? Boolean(labelFormatter);

    return {
      type: baseSeriesType,
      name: series.name,
      yAxisIndex: series.yAxisIndex ?? 0,
      stack: typeof series.stackGroup === "number" ? `stack-${series.stackGroup}` : undefined,
      smooth: series.smooth,
      label: showLabel ? { show: true, formatter: labelFormatter } : undefined,
      itemStyle: series.color ? { color: series.color } : undefined,
      areaStyle: isAreaSeries ? {} : undefined,
      encode: {
        x: chartDefinition.categoryField,
        y: series.field,
      },
    } satisfies EChartsSeries;
  });
}

export function transformChartDefinitionToECharts(
  chartDefinition: SimplifiedChartDefinition,
  executionData: ExecutionData
): EChartsOptionLike {
  if (!executionData.dimensions.length) {
    throw new Error("Resultado da consulta sem dimensoes para montar grafico.");
  }

  if (!chartDefinition.series || chartDefinition.series.length === 0) {
    throw new Error("Definicao de grafico sem series.");
  }

  assertFieldExists(chartDefinition.categoryField, executionData.dimensions);
  chartDefinition.series.forEach((series) => assertFieldExists(series.field, executionData.dimensions));

  const isPie = chartDefinition.chartType === "pie";
  const tooltipFormatter = resolveFormatterFunction(
    chartDefinition.tooltip?.formatterFunction,
    "tooltip.formatterFunction"
  );

  const chartConfig: EChartsOptionLike = {
    title: {
      text: chartDefinition.title ?? "Visualizacao",
      padding: [10, 0, 30, 0],
    },
    dataset: {
      dimensions: executionData.dimensions,
      source: executionData.source,
    },
    tooltip: {
      trigger: isPie ? "item" : "axis",
      formatter: tooltipFormatter,
    },
    legend: resolveLegendConfig(chartDefinition.legend),
    series: buildSeries(chartDefinition),
  };

  if (!isPie) {
    chartConfig.xAxis = {
      type: "category",
      name: chartDefinition.categoryField,
    };

    chartConfig.yAxis = buildYAxis(chartDefinition.axes, chartDefinition.series);
    chartConfig.grid = {
      top: 50,
      left: 20,
      right: 20,
      bottom: 50,
      containLabel: true,
    };
  }

  return chartConfig;
}
