import { tool, type Tool } from "ai";
import { z } from "zod";
import { t } from "../prompts/provider.js";

export function createAskUserTool(
  onAsk: (question: string, opts: string[]) => Promise<string>,
): Tool {
  return tool({
    description: t("tools.ask_opts"),
    inputSchema: z.object({
      question: z.string().describe(t("tools.arg_question")),
      opts: z.array(z.string()).describe(t("tools.arg_opts")),
    }),
    execute: async ({ question, opts }) => {
      return onAsk(question, opts);
    },
  });
}
