import vm from "node:vm";
import { parse } from "node-html-parser";

export interface ChartHtmlValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateChartHtml(html: string): ChartHtmlValidationResult {
    const errors: string[] = [];

    // ── Structural checks via HTML parser ────────────────────────────────────

    let root;
    try {
        root = parse(html);
    } catch {
        return { valid: false, errors: ["HTML is not parseable"] };
    }

    const scripts = root.querySelectorAll("script");

    // Check for ECharts CDN reference
    const hasEchartsCdn = scripts.some(
        (s) => s.getAttribute("src")?.includes("cdn.jsdelivr.net/npm/echarts")
    );
    if (!hasEchartsCdn) {
        errors.push("Missing <script> tag referencing ECharts CDN (cdn.jsdelivr.net/npm/echarts)");
    }

    // Check for chart container div
    const chartDiv = root.querySelector("#chart");
    if (!chartDiv) {
        errors.push('Missing <div id="chart"> element');
    }

    // Collect inline script content (exclude CDN-only script tags)
    const inlineScripts = scripts
        .filter((s) => !s.getAttribute("src") && s.textContent.trim().length > 0)
        .map((s) => s.textContent);

    const allScriptContent = inlineScripts.join("\n");

    // Check for window.CHART_DATA reference
    if (!allScriptContent.includes("CHART_DATA")) {
        errors.push("No reference to window.CHART_DATA found in inline scripts");
    }

    // Check for echarts.init call
    if (!allScriptContent.includes("echarts.init")) {
        errors.push("No echarts.init() call found in inline scripts");
    }

    // ── JS syntax check via vm.compileFunction ───────────────────────────────

    for (let i = 0; i < inlineScripts.length; i++) {
        const scriptContent = inlineScripts[i]!;
        try {
            vm.compileFunction(scriptContent);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const label = inlineScripts.length > 1 ? ` (script ${i + 1})` : "";
            errors.push(`JS syntax error${label}: ${message}`);
        }
    }

    return { valid: errors.length === 0, errors };
}
