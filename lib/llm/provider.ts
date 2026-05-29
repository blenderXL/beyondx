/**
 * Provider-agnostic LLM interface. v1.0 ships the interface only; v1.2 adds
 * ClaudeProvider / GeminiProvider implementations that conform to this shape.
 * Swap providers by changing one config line.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  toolCallId?: string;
}

export interface Tool<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  /** JSON Schema of arguments. */
  parameters: Record<string, unknown>;
  execute: (args: TArgs) => Promise<TResult>;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  toolCalls?: { name: string; arguments: unknown }[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface StreamChunk {
  type: "text" | "tool_call" | "done";
  text?: string;
  toolCall?: { name: string; arguments: unknown };
}

export interface LLMProvider {
  readonly name: string;
  generate(messages: Message[], options?: GenerateOptions): Promise<GenerateResult>;
  streamGenerate(messages: Message[], options?: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** Placeholder used by v1.0 code paths that must not call an LLM yet. */
export const NULL_PROVIDER: LLMProvider = {
  name: "null",
  async generate() {
    throw new Error("LLM is not enabled in v1.0. Wire a provider in v1.2.");
  },
  async *streamGenerate() {
    throw new Error("LLM is not enabled in v1.0. Wire a provider in v1.2.");
  },
};
