export function stripMarkdownFences(text: string): string {
    return text.replace(/^```(?:\w+)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}
