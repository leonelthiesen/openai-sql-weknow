import OpenAI from "openai";
import { faker } from "@faker-js/faker";
import { MODEL_INSTRUCTIONS, type OpenAIResponseSchema } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import TOOL_DEFINITIONS from "../../data/llm-tool-definitions.json";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-5-mini-2025-08-07";

const SHARED_OPTIONS = {
  model: MODEL,
  reasoning: { effort: "minimal" as const },
  include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

const CHART_TOOL_DEFINITION = TOOL_DEFINITIONS.find((t) => t.name === "generate_chart_config")!;
const FIRST_CALL_TOOLS = TOOL_DEFINITIONS.filter((t) => t.name !== "generate_chart_config");

export interface ToolCallResult {
  structuredOutput: OpenAIResponseSchema;
  toolCallId: string;
  toolCallName: string;
  toolCallArguments: string;
  reasoningItems: OpenAI.Responses.ResponseOutputItem[];
}

/**
 * Generates fake tabular data (max 10 rows) based on query column definitions.
 * Column type is inferred from the column name and measureFunction.
 */
function generateFakeData(query: any): Record<string, unknown>[] {
  const columns: Array<{ completeName: string; measureFunction: number }> =
    query?.columns ?? [];

  return Array.from({ length: 10 }, () => {
    const row: Record<string, unknown> = {};

    for (const col of columns) {
      const name = (col.completeName ?? "").toLowerCase();
      const isNumericAggregation = col.measureFunction !== 0;

      if (isNumericAggregation) {
        row[col.completeName] = faker.number.float({ min: 100, max: 100_000, fractionDigits: 2 });
      } else if (/data|date|dt_|_dt/.test(name)) {
        row[col.completeName] = faker.date.recent({ days: 365 }).toISOString().split("T")[0];
      } else if (/valor|value|preco|price|total|qtd|qty|amount|custo|cost/.test(name)) {
        row[col.completeName] = faker.number.float({ min: 10, max: 10_000, fractionDigits: 2 });
      } else if (/id$|_id/.test(name)) {
        row[col.completeName] = faker.number.int({ min: 1, max: 9999 });
      } else {
        row[col.completeName] = faker.company.name();
      }
    }

    return row;
  });
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
  input: ResponseInputItem[]
): Promise<ToolCallResult> {
  // ── First call: execute_query or ask_followup ────────────────────────────
  const firstResponse = await openai.responses.create({
    ...SHARED_OPTIONS,
    instructions: MODEL_INSTRUCTIONS,
    input,
    tools: FIRST_CALL_TOOLS as OpenAI.Responses.Tool[],
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
  console.log(`[openai] 1st call → ${primaryCall.name}`, JSON.stringify(primaryArgs, null, 2));

  // Reasoning items must be passed back with tool call outputs on subsequent turns
  const reasoningItems = firstResponse.output.filter(
    (item): item is OpenAI.Responses.ResponseOutputItem => item.type === "reasoning"
  );

  // ── ask_followup: nothing more to do ────────────────────────────────────
  if (primaryCall.name === "ask_followup") {
    return {
      structuredOutput: {
        action: "FOLLOWUP_NEEDED",
        message: primaryArgs.message,
        userMessageSuggestions: primaryArgs.userMessageSuggestions,
      },
      toolCallId: primaryCall.call_id,
      toolCallName: primaryCall.name,
      toolCallArguments: primaryCall.arguments,
      reasoningItems,
    };
  }

  // ── execute_query: optionally call generate_chart_config ────────────────
  const fakeData = generateFakeData(primaryArgs.query);
  let chartConfig: object | undefined;

  if (primaryArgs.renderType === "CHART") {
    const functionCallOutputs = buildFunctionCallOutputs(
      firstCalls,
      primaryCall.call_id,
      JSON.stringify({ columns: primaryArgs.query.columns ?? [], rows: fakeData })
    );

    // ── Second call: generate_chart_config ──────────────────────────────
    const secondResponse = await openai.responses.create({
      ...SHARED_OPTIONS,
      instructions: MODEL_INSTRUCTIONS,
      input: [
        ...input,
        ...(firstResponse.output as unknown as ResponseInputItem[]),
        ...functionCallOutputs,
      ],
      tools: [CHART_TOOL_DEFINITION] as OpenAI.Responses.Tool[],
      tool_choice: "required",
    });

    const chartCalls = secondResponse.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call"
    );

    if (chartCalls.length > 0) {
      const chartCall = chartCalls[0]!;
      chartConfig = JSON.parse(chartCall.arguments).chartConfig;
      console.log("[openai] 2nd call → generate_chart_config", JSON.stringify(chartCall, null, 2));
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
    toolCallId: primaryCall.call_id,
    toolCallName: primaryCall.name,
    toolCallArguments: primaryCall.arguments,
    reasoningItems,
  };
}
