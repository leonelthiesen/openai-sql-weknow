import OpenAI from "openai";
import { MODEL_INSTRUCTIONS, type OpenAIResponseSchema } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
  getExecuteQueryToolDefinition,
  getRenderChartToolDefinition,
  getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import { generateFakeData } from "../utils/fake-data";
import type { ExecutionData, OpenAiItem } from "./chat.service";
import * as weknowService from "./weknow.service";
import { transformLLMToComponentExecuteInput } from "../utils/llm-to-weknow-component-execute";
import type { LLMStructuredOutput } from "../models/llm-structured-output.models";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-5-mini-2025-08-07";

const SHARED_OPTIONS = {
  model: MODEL,
  reasoning: { effort: "minimal" as const },
  include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

export interface ToolCallResult {
  structuredOutput: OpenAIResponseSchema;
  openAiItems: OpenAiItem[];
  executionData?: ExecutionData;
  errorResponse?: string | Object;
}

function transformExecuteResult(data: any): ExecutionData {
  let dimensions: string[] = [];
  let source: (string | number | null)[][] = [];
  if (data && data.cols && data.rows) {
    dimensions = data.cols.map((col: any) => col.completeName);
    source = data.rows.map((row: any) => row.cells.map((cell: any) => cell.value));
  }
  return { dimensions, source };
}

/**
 * Builds function_call_output items for every function call in a response,
 * supplying real data for the primary call and a stub for any extras.
 */
function buildFunctionCallOutputs(
  calls: OpenAI.Responses.ResponseFunctionToolCall[],
  primaryCallId: string,
  primaryOutput: string
): ResponseInputItem[] {
  return calls.map((call) => ({
    type: "function_call_output" as const,
    call_id: call.call_id,
    output: call.call_id === primaryCallId ? primaryOutput : "OK",
  }));
}

export async function createModelResponse(
  input: ResponseInputItem[],
  metadataId: number
): Promise<ToolCallResult> {
  const openAiItems: OpenAiItem[] = [];

  // ── First call: execute_query or ask_followup ────────────────────────────
  const firstResponse = await openai.responses.create({
    ...SHARED_OPTIONS,
    instructions: MODEL_INSTRUCTIONS,
    input,
    tools: [getExecuteQueryToolDefinition(), getAskFollowupToolDefinition()],
    tool_choice: "required",
  });

  const firstCalls = firstResponse.output.filter(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
      item.type === "function_call"
  );

  if (firstCalls.length === 0) {
    console.error("[openai] 1st call: no function_call in output", JSON.stringify(firstResponse.output, null, 2));
    throw new Error("Model did not return a function call.");
  }

  if (firstCalls.length > 1) {
    console.warn(`[openai] 1st call: ${firstCalls.length} function calls returned, using first`);
  }

  const primaryCall = firstCalls[0]!;
  const primaryArgs = JSON.parse(primaryCall.arguments);

  // Collect reasoning items from first response
  const reasoningItems = firstResponse.output.filter(
    (item) => item.type === "reasoning"
  );
  for (const item of reasoningItems) {
    openAiItems.push({ type: "reasoning", reasoningItem: item });
  }

  // Collect function_call item
  openAiItems.push({
    type: "function_call",
    callId: primaryCall.call_id,
    name: primaryCall.name,
    arguments: primaryCall.arguments,
  });

  // ── ask_followup: nothing more to do ────────────────────────────────────
  if (primaryCall.name === "ask_followup") {
    // Collect function_call_output
    openAiItems.push({
      type: "function_call_output",
      callId: primaryCall.call_id,
      output: "Message delivered to the user.",
    });

    return {
      structuredOutput: {
        action: "FOLLOWUP_NEEDED",
        message: primaryArgs.message,
        userMessageSuggestions: primaryArgs.userMessageSuggestions,
      },
      openAiItems,
    };
  }

  // ── execute_query: execute real query via WeKnow, optionally call render_chart_config ──
  const structuredOutputForExec = {
    action: "EXECUTE_QUERY" as const,
    message: primaryArgs.message,
    renderType: primaryArgs.renderType,
    query: primaryArgs.query,
    userMessageSuggestions: primaryArgs.userMessageSuggestions,
  } satisfies LLMStructuredOutput;

  let executionData: ExecutionData | undefined;
  let errorResponse: string | Object | undefined;

  const executeInput = transformLLMToComponentExecuteInput(structuredOutputForExec, metadataId);
  if (executeInput) {
    try {
      const accessToken = await weknowService.getAccessToken();
      executeInput.accessToken = accessToken;
      const executeResult = await weknowService.executeComponent(JSON.stringify(executeInput));
      executionData = transformExecuteResult(executeResult);
    } catch (error: any) {
      errorResponse = error;
      console.error("Erro ao executar componente no Weknow:", error);
    }
  }

  // Use real data if available, otherwise fall back to fake data for the LLM context
  const dataForLLM = executionData
    ? { dimensions: executionData.dimensions, source: executionData.source.slice(0, 20) }
    : generateFakeData(primaryArgs.query);

  // Collect function_call_output for execute_query
  const executeOutput = executionData
    ? "Query executed successfully. Result (first rows): " + JSON.stringify(dataForLLM)
    : "Query executed successfully. Result using fabricated data: " + JSON.stringify(dataForLLM);
  openAiItems.push({
    type: "function_call_output",
    callId: primaryCall.call_id,
    output: executeOutput,
  });

  let chartConfig: object | undefined;

  if (primaryArgs.renderType === "CHART") {
    const functionCallOutputs = buildFunctionCallOutputs(
      firstCalls,
      primaryCall.call_id,
      JSON.stringify(dataForLLM)
    );

    // ── Second call: render_chart_config ──────────────────────────────
    const columns: Array<{ completeName: string; measureFunction: number; title?: string }> =
      primaryArgs.query.columns ?? [];
    const columnSummary = columns
      .map((c) => {
        const label = c.title ?? c.completeName;
        const role = c.measureFunction === 0 ? "dimension" : "measure";
        return `- "${c.completeName}" (${label}) → ${role}`;
      })
      .join("\n");

    const developerContent = [
      "The execute_query tool was called and sample query results are provided above.",
      "Now call render_chart_config to create an Apache ECharts v6 configuration to visualize this data.",
      "",
      "Columns in the dataset:",
      columnSummary,
      "",
      "Requirements for the chartConfig argument:",
      '- Use the "dataset" option with "dimensions" and "source" both as empty arrays (real data will be injected later).',
      "- Use friendly Portuguese titles/legends (e.g., DATA_EMISSAO → Data de Emissão).",
      "- Position legends below or beside the chart.",
      "- Chart title must have padding (e.g., padding: [10, 0, 30, 0]).",
      "- Axis titles should be centered and vertical where applicable.",
    ].join("\n");

    // Add developer message to openAiItems
    openAiItems.push({
      type: "message",
      role: "developer",
      content: developerContent,
    });

    const secondCallInput: ResponseInputItem[] = [
      ...input,
      ...(firstResponse.output as unknown as ResponseInputItem[]),
      ...functionCallOutputs,
      {
        role: "developer",
        content: developerContent,
      } as ResponseInputItem,
    ];

    const secondResponse = await openai.responses.create({
      ...SHARED_OPTIONS,
      instructions: MODEL_INSTRUCTIONS,
      input: secondCallInput,
      tools: [getRenderChartToolDefinition()],
      tool_choice: "required",
    });

    const chartCalls = secondResponse.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call"
    );

    if (chartCalls.length > 0) {
      const chartCall = chartCalls[0]!;
      chartConfig = JSON.parse(chartCall.arguments).chartConfig;

      // Collect chart function_call and output
      openAiItems.push({
        type: "function_call",
        callId: chartCall.call_id,
        name: chartCall.name,
        arguments: chartCall.arguments,
      });
      openAiItems.push({
        type: "function_call_output",
        callId: chartCall.call_id,
        output: "OK",
      });
    } else {
      console.error("[openai] 2nd call: no function_call in output", JSON.stringify(secondResponse.output, null, 2));
    }
  }

  return {
    structuredOutput: {
      action: "EXECUTE_QUERY",
      message: primaryArgs.message,
      userMessageSuggestions: primaryArgs.userMessageSuggestions,
      renderType: primaryArgs.renderType,
      query: primaryArgs.query,
      chartConfig,
    },
    openAiItems,
    executionData,
    errorResponse,
  };
}
