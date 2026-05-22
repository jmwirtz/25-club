import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude";
import { buildPortfolioContext, getEnrichedPortfolio } from "@/lib/portfolio";
import { MEMBERS } from "@/lib/members";
import { fetchQuotes } from "@/lib/prices";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { ticker } = (await req.json()) as { ticker?: string };
  const symbol = (ticker ?? "").trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Provide a valid ticker symbol." }, { status: 400 });
  }

  const [{ holdings }, quotes] = await Promise.all([
    getEnrichedPortfolio(),
    fetchQuotes([symbol]),
  ]);

  const q = quotes[symbol];
  if (!q || q.price === null) {
    return NextResponse.json(
      { error: `Could not fetch a price for ${symbol}. Double-check the ticker.` },
      { status: 404 },
    );
  }

  const alreadyHeld = holdings.find((h) => h.ticker === symbol);
  const portfolioContext = buildPortfolioContext(holdings);
  const memberRoster = MEMBERS.map(
    (m) => `- ${m.lastName}${m.background ? `: ${m.background}` : ""}`,
  ).join("\n");

  const systemPrompt = `You are an investment analyst helping the "25 Club," a long-running investment club, evaluate a stock idea. Be candid, specific, and concise. Avoid hedge-everything language. Cite real risks and real strengths.

Output strictly in Markdown with these sections, in order:

## Snapshot
One paragraph: what the company does, the bull case in one sentence, the bear case in one sentence.

## Fit with the 25 Club Portfolio
How would adding this position interact with the current portfolio? Consider sector/factor overlap (e.g., if they already own AI/semi exposure via NVDA/AMD/ASML), correlation, concentration, and diversification. Be specific about which existing holdings make this redundant or complementary.

## Bull Case
3–5 bullet points. Be specific to this company.

## Bear Case / Risks
3–5 bullet points. Be specific.

## Key Things to Watch
2–4 bullet points of metrics or catalysts the club should monitor.

## Conversation Hooks for the Club
A short list of 2–4 angles that could spark meeting discussion, ideally tying to specific club members' apparent interests when those are known (use the member roster provided). If a member's background is unknown, you may instead suggest topical hooks (e.g., "discuss vs. existing NVDA position with Buckley, the point person").`;

  const userPrompt = `The user wants you to analyze: **${symbol}** (current price ~$${q.price?.toFixed(2)} ${q.currency ?? "USD"}).

${alreadyHeld
  ? `NOTE: ${symbol} is ALREADY in the portfolio (${alreadyHeld.quantity} shares, point person: ${alreadyHeld.member ?? "n/a"}). Frame the analysis as a review of the existing position and whether to add, hold, or trim.`
  : `${symbol} is NOT currently in the portfolio. Frame the analysis as evaluating a new idea.`}

### Current portfolio (live prices)
${portfolioContext}

### Club members (last name — background notes if any)
${memberRoster}

Respond with the structured Markdown analysis described in the system prompt.`;

  try {
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({
      ticker: symbol,
      price: q.price,
      currency: q.currency ?? "USD",
      alreadyHeld: Boolean(alreadyHeld),
      analysis: text,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude API call failed: ${msg}` }, { status: 500 });
  }
}
