import type { AnswerSymbol } from "@trackoot/types";

export const SYMBOL_META: Record<AnswerSymbol, { label: string; bg: string; hover: string }> = {
  triangle: { label: "▲", bg: "bg-answer-triangle", hover: "hover:brightness-110" },
  diamond: { label: "◆", bg: "bg-answer-diamond", hover: "hover:brightness-110" },
  circle: { label: "●", bg: "bg-answer-circle", hover: "hover:brightness-110" },
  square: { label: "■", bg: "bg-answer-square", hover: "hover:brightness-110" },
};
