import type OpenAI from "openai";
import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
    getRenderChartToolDefinition,
} from "./tool-definitions";

type FunctionTool = OpenAI.Responses.FunctionTool;

export type ToolPhase = "primary" | "secondary";

interface ToolRegistration {
    definition: FunctionTool;
    phase: ToolPhase;
}

const registry: ToolRegistration[] = [
    { definition: getExtractDataToolDefinition(), phase: "primary" },
    { definition: getAskFollowupToolDefinition(), phase: "primary" },
    { definition: getRenderChartToolDefinition(), phase: "secondary" },
];

export function getToolsForPhase(phase: ToolPhase): FunctionTool[] {
    return registry
        .filter((reg) => reg.phase === phase)
        .map((reg) => reg.definition);
}

export function getToolByName(name: string): FunctionTool | undefined {
    return registry.find((reg) => reg.definition.name === name)?.definition;
}
