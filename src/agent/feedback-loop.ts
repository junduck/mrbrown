import {
  AISDKError,
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { ZodType } from "zod";
import { t } from "../prompts/provider.js";
import { getLogger } from "../log.js";

export type FeedbackResult =
  | { type: "ok" }
  | { type: "info"; feedback: string[] }
  | { type: "error"; feedback: string[] };
export type FeedbackFn<T> = (obj: T) => Promise<FeedbackResult>;

export type FbDoneEvent<T> = {
  type: "done";
  result: T;
  context: ModelMessage[];
};

export type FbFailEvent = {
  type: "fail";
  error: string;
  context: ModelMessage[];
};

export interface FbLoopOpts<T> {
  model: LanguageModel;
  system: string;
  tools?: ToolSet;
  outputSchema: ZodType<T>;
  outputFeedback: FeedbackFn<T>[];
  maxStep?: number;
  maxToolSteps?: number;
}

// Multi-step validator feedback agentic loop
export class FeedbackLoop<T> {
  private readonly logger = getLogger().child({ module: "FeedbackLoop" });
  private readonly model: LanguageModel;
  private readonly system: string;
  private readonly tools: ToolSet;
  private readonly outputSchema: ZodType<T>;
  private readonly outputFeedback: FeedbackFn<T>[];
  private readonly maxStep: number;
  private readonly maxToolSteps: number;

  constructor(opts: FbLoopOpts<T>) {
    this.model = opts.model;
    this.system = opts.system;
    this.tools = opts.tools ?? {};
    this.outputSchema = opts.outputSchema;
    this.outputFeedback = opts.outputFeedback;
    this.maxStep = opts.maxStep ?? 5;
    this.maxToolSteps = opts.maxToolSteps ?? 25;
  }

  private pushMsg(list: Array<any>, msg: { role: string; content: any }) {
    list.push(msg);
    let comm;
    switch (msg.role) {
      case "system":
      case "user":
      case "tool":
        comm = "<---";
        break;
      case "assistant":
        comm = "--->";
        break;
      default:
        comm = "?";
    }
    this.logger.trace({
      comm,
      role: msg.role,
      content: msg.content,
    });
  }

  async run(
    opts: {
      request: string;
      maxStep?: number;
      context?: ModelMessage[];
    } & Omit<
      Parameters<typeof generateText>[0],
      | "model"
      | "messages"
      | "output"
      | "tools"
      | "stopWhen"
      | "system"
      | "prompt"
    >,
  ): Promise<FbDoneEvent<T> | FbFailEvent> {
    const { request, maxStep, context, ...genOpts } = opts;

    const messages: ModelMessage[] = [];
    if (context) {
      for (const msg of context) this.pushMsg(messages, msg);
    } else {
      this.pushMsg(messages, { role: "system", content: this.system });
    }
    this.pushMsg(messages, { role: "user", content: request });

    const max = maxStep ?? this.maxStep;
    for (let i = 0; i < max; ++i) {
      try {
        const result = await generateText({
          model: this.model,
          messages,
          tools: this.tools,
          stopWhen: stepCountIs(this.maxToolSteps),
          ...genOpts,
        });

        for (const msg of result.response.messages) {
          this.pushMsg(messages, msg);
        }

        let output: T;
        try {
          const parsed = this.outputSchema.safeParse(JSON.parse(result.text));
          if (!parsed.success) {
            const err = parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            this.pushMsg(messages, { role: "user", content: err });
            continue;
          }
          output = parsed.data;
        } catch (e) {
          this.pushMsg(messages, {
            role: "user",
            content: `JSON parse error: ${(e as Error).message}`,
          });
          continue;
        }

        const fb: string[] = [];
        for (const fn of this.outputFeedback) {
          const tmp = await fn(output);
          if (tmp.type === "ok") continue;
          fb.push(...tmp.feedback);
          if (tmp.type === "error") break;
        }
        if (fb.length === 0) {
          return { type: "done", result: output, context: messages };
        }

        this.pushMsg(messages, {
          role: "user",
          content: t("fbloop.feedback", {
            feedback: JSON.stringify(fb),
          }),
        });
      } catch (e) {
        if (AISDKError.isInstance(e)) {
          this.pushMsg(messages, {
            role: "user",
            content: t("generic.error", {
              name: e.name,
              message: e.message,
            }),
          });
        } else {
          // rethrow unexpected: non agent related
          throw e;
        }
      }
    }

    return {
      type: "fail",
      error: t("fbloop.fail_exhausted"),
      context: messages,
    };
  }
}
