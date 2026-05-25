import { HOLDINGS } from "./holdings";
import { fetchQuotes } from "./prices";
import type { EnrichedHolding } from "./types";

export async function getEnrichedPortfolio(): Promise<{
  holdings: EnrichedHolding[];
  totals: {
    purchaseCost: number;
    marketValue: number;
    gainLoss: number;
    gainLossPct: number;
    priced: number;
    total: number;
  };
}> {
  const tickers = HOLDINGS.map((h) => h.ticker);
  const quotes = await fetchQuotes(tickers);

  const holdings: EnrichedHolding[] = HOLDINGS.map((h) => {
    const price = quotes[h.ticker]?.price ?? null;
    const marketValue = price !== null ? price * h.quantity : null;
    const gainLoss = marketValue !== null ? marketValue - h.purchaseCost : null;
    const gainLossPct =
      marketValue !== null && h.purchaseCost > 0
        ? ((marketValue - h.purchaseCost) / h.purchaseCost) * 100
        : null;
    const holdYears = Math.max(
      1 / 12,
      (Date.now() - new Date(h.originalDOP).getTime()) / (365.25 * 24 * 3600 * 1000),
    );
    const annualizedReturnPct =
      gainLossPct !== null
        ? (Math.pow(1 + gainLossPct / 100, 1 / holdYears) - 1) * 100
        : null;
    return {
      ...h,
      avgCost: h.quantity > 0 ? h.purchaseCost / h.quantity : 0,
      currentPrice: price,
      marketValue,
      gainLoss,
      gainLossPct,
      annualizedReturnPct,
    };
  });

  const priced = holdings.filter((h) => h.marketValue !== null);
  const purchaseCost = priced.reduce((s, h) => s + h.purchaseCost, 0);
  const marketValue = priced.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const gainLoss = marketValue - purchaseCost;
  const gainLossPct = purchaseCost > 0 ? (gainLoss / purchaseCost) * 100 : 0;

  return {
    holdings,
    totals: {
      purchaseCost,
      marketValue,
      gainLoss,
      gainLossPct,
      priced: priced.length,
      total: holdings.length,
    },
  };
}

export function buildPortfolioContext(
  enriched: EnrichedHolding[],
): string {
  const lines = enriched.map((h) => {
    const pct = h.gainLossPct !== null ? `${h.gainLossPct.toFixed(1)}%` : "n/a";
    const mv = h.marketValue !== null ? `$${Math.round(h.marketValue).toLocaleString()}` : "n/a";
    const member = h.member ?? "—";
    return `${h.ticker} (${h.name}) | ${h.assetClass} | qty ${h.quantity} | mv ${mv} | g/l ${pct} | point: ${member}`;
  });
  return lines.join("\n");
}
