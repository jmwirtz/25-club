import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude";
import { buildPortfolioContext, getEnrichedPortfolio } from "@/lib/portfolio";
import { MEMBERS } from "@/lib/members";
import { fetchSnapshot, resolveTicker } from "@/lib/prices";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { query } = (await req.json()) as { query?: string };
  const input = (query ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "Enter a company name or ticker." }, { status: 400 });
  }

  const resolved = await resolveTicker(input);
  if (!resolved) {
    return NextResponse.json(
      { error: `Couldn't find a stock matching "${input}". Try a different name or ticker.` },
      { status: 404 },
    );
  }

  const [{ holdings }, snapshot] = await Promise.all([
    getEnrichedPortfolio(),
    fetchSnapshot(resolved.symbol),
  ]);

  if (!snapshot) {
    return NextResponse.json(
      { error: `Couldn't fetch quote data for ${resolved.symbol}.` },
      { status: 404 },
    );
  }

  const alreadyHeld = holdings.find((h) => h.ticker === snapshot.symbol);
  const portfolioContext = buildPortfolioContext(holdings);
  const memberRoster = MEMBERS.map(
    (m) => `- ${m.lastName}${m.background ? `: ${m.background}` : ""}`,
  ).join("\n");

  const keyStats = [
    snapshot.marketCap !== null && `Market cap: ${fmtBig(snapshot.marketCap)}`,
    snapshot.trailingPE !== null && `Trailing P/E: ${snapshot.trailingPE.toFixed(1)}`,
    snapshot.forwardPE !== null && `Forward P/E: ${snapshot.forwardPE.toFixed(1)}`,
    snapshot.dividendYield !== null && `Dividend yield: ${(snapshot.dividendYield * 100).toFixed(2)}%`,
    snapshot.beta !== null && `Beta: ${snapshot.beta.toFixed(2)}`,
    snapshot.fiftyTwoWeekChange !== null && `1Y price change: ${(snapshot.fiftyTwoWeekChange * 100).toFixed(1)}%`,
    snapshot.profitMargin !== null && `Net margin: ${(snapshot.profitMargin * 100).toFixed(1)}%`,
    snapshot.targetMeanPrice !== null && `Analyst avg target: $${snapshot.targetMeanPrice.toFixed(0)} (current $${snapshot.price.toFixed(0)})`,
    snapshot.sector && `Sector: ${snapshot.sector}`,
  ].filter(Boolean).join("\n");

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

  const userPrompt = `Analyze: **${snapshot.symbol} — ${snapshot.name}** (${snapshot.exchange})
Current price: $${snapshot.price.toFixed(2)} ${snapshot.currency}

### Live key statistics
${keyStats}

${alreadyHeld
  ? `NOTE: ${snapshot.symbol} is ALREADY in the portfolio (${alreadyHeld.quantity} shares, point person: ${alreadyHeld.member ?? "n/a"}). Frame the analysis as a review of the existing position and whether to add, hold, or trim.`
  : `${snapshot.symbol} is NOT currently in the portfolio. Frame the analysis as evaluating a new idea.`}

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
      snapshot,
      alreadyHeld: alreadyHeld
        ? { quantity: alreadyHeld.quantity, member: alreadyHeld.member, gainLossPct: alreadyHeld.gainLossPct }
        : null,
      analysis: text,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude API call failed: ${msg}` }, { status: 500 });
  }
}

function fmtBig(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
