import { MarkedSelection } from "@/types";

export function formatSelectionsContext(
  selections: MarkedSelection[],
  filename: string = "draft.md",
): string {
  if (selections.length === 0) return "";

  const header = `The following message relates to these selected parts of ${filename}:`;

  const formattedSelections = selections
    .map((s, index) => {
      return `[Selection ${index + 1}] Line ${s.line}, Col ${s.column + 1} (${s.length} chars): "${s.text}"`;
    })
    .join("\n");

  return `${header}\n\n${formattedSelections}\n`;
}
