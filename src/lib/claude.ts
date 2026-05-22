import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}
