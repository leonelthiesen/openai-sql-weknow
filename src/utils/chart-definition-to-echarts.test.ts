import { describe, expect, test } from "vitest";
import type { SimplifiedChartDefinition } from "../models/llm-structured-output.models";
import type { ExecutionData } from "../services/chat.service";
import { transformChartDefinitionToECharts } from "./chart-definition-to-echarts";

const baseExecutionData: ExecutionData = {
  dimensions: ["categoria", "receita", "lucro", "margem_percentual"],
  source: [
    ["A", 1000, 220, 22],
    ["B", 800, 120, 15],
    ["C", 1200, 260, 21.7],
  ],
};

describe("transformChartDefinitionToECharts", () => {
  test("converte grafico bar com uma serie", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "bar",
      categoryField: "categoria",
      title: "Receita por categoria",
      series: [{ field: "receita", name: "Receita" }],
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.xAxis?.type).toBe("category");
    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.type).toBe("bar");
    expect(result.series[0]?.encode?.x).toBe("categoria");
    expect(result.series[0]?.encode?.y).toBe("receita");
  });

  test("converte grafico com multiplas series no mesmo eixo", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "bar",
      categoryField: "categoria",
      series: [
        { field: "receita", name: "Receita", stackGroup: 1 },
        { field: "lucro", name: "Lucro", stackGroup: 1 },
      ],
      legend: { position: "right" },
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.series).toHaveLength(2);
    expect(result.series[0]?.stack).toBe("stack-1");
    expect(result.series[1]?.stack).toBe("stack-1");
    expect(result.legend?.orient).toBe("vertical");
  });

  test("converte line+bar com eixos distintos", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "line",
      categoryField: "categoria",
      series: [
        { field: "receita", name: "Receita", seriesType: "bar", yAxisIndex: 0 },
        { field: "margem_percentual", name: "Margem", seriesType: "line", yAxisIndex: 1, smooth: true },
      ],
      axes: [
        { index: 0, name: "Receita", format: "currency", currencySymbol: "R$" },
        { index: 1, name: "Margem", format: "percent" },
      ],
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.yAxis).toHaveLength(2);
    expect(result.series[0]?.yAxisIndex).toBe(0);
    expect(result.series[1]?.yAxisIndex).toBe(1);
    expect(result.series[1]?.smooth).toBe(true);
  });

  test("converte grafico area para line com areaStyle", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "area",
      categoryField: "categoria",
      series: [{ field: "receita", name: "Receita" }],
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.series[0]?.type).toBe("line");
    expect(result.series[0]?.areaStyle).toEqual({});
  });

  test("converte grafico pie", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "pie",
      categoryField: "categoria",
      series: [{ field: "receita", name: "Receita" }],
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.tooltip.trigger).toBe("item");
    expect(result.xAxis).toBeUndefined();
    expect(result.yAxis).toBeUndefined();
    expect(result.series[0]?.type).toBe("pie");
    expect(result.series[0]?.encode?.itemName).toBe("categoria");
    expect(result.series[0]?.encode?.value).toBe("receita");
  });

  test("propaga formatter em formato de funcao para tooltip, eixo e label", () => {
    const tooltipFormatter = "function (params) { return params[0].name; }";
    const axisFormatter = "function (value) { return 'R$ ' + value; }";
    const labelFormatter = "function (params) { return params.value; }";

    const definition: SimplifiedChartDefinition = {
      chartType: "bar",
      categoryField: "categoria",
      tooltip: {
        formatterFunction: tooltipFormatter,
      },
      axes: [
        {
          index: 0,
          formatterFunction: axisFormatter,
        },
      ],
      series: [
        {
          field: "receita",
          name: "Receita",
          labelFormatterFunction: labelFormatter,
        },
      ],
    };

    const result = transformChartDefinitionToECharts(definition, baseExecutionData);

    expect(result.tooltip.formatter).toBe(tooltipFormatter);
    expect(result.yAxis?.[0]?.axisLabel?.formatter).toBe(axisFormatter);
    expect(result.series[0]?.label?.formatter).toBe(labelFormatter);
    expect(result.series[0]?.label?.show).toBe(true);
  });

  test("rejeita formatter fora do formato de funcao", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "bar",
      categoryField: "categoria",
      tooltip: {
        formatterFunction: "{value}%",
      },
      series: [{ field: "receita", name: "Receita" }],
    };

    expect(() => transformChartDefinitionToECharts(definition, baseExecutionData)).toThrow(
      "Formatter invalido em tooltip.formatterFunction. Use o formato: function (...) { ... }."
    );
  });

  test("lanca erro quando campo nao existe no resultado", () => {
    const definition: SimplifiedChartDefinition = {
      chartType: "bar",
      categoryField: "categoria_inexistente",
      series: [{ field: "receita", name: "Receita" }],
    };

    expect(() => transformChartDefinitionToECharts(definition, baseExecutionData)).toThrow(
      "Campo 'categoria_inexistente' nao foi encontrado no resultado da consulta."
    );
  });
});
