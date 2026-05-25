import { SNAPSHOTS, type MonthlySnapshot, type SnapshotHolding } from "./snapshots.generated";

export type TransactionAction = "NEW_BUY" | "EXIT" | "INCREASE" | "DECREASE" | "REBUY";

export type Transaction = {
  id: string;
  monthKey: string;
  asOf: string | null;
  ticker: string;
  name: string;
  action: TransactionAction;
  sharesBefore: number;
  sharesAfter: number;
  sharesDelta: number;
  /** Per-share price at the time of the transaction (best estimate). */
  estimatedPrice: number | null;
  /** Cash deployed (positive for buys) or freed (positive for sells). */
  estimatedCashFlow: number | null;
  member: string | null;
  assetClass: string;
};

/** Build a ticker → holding map for a snapshot, keyed on ticker (skipping unmapped). */
function indexByTicker(snapshot: MonthlySnapshot): Map<string, SnapshotHolding> {
  const m = new Map<string, SnapshotHolding>();
  for (const h of snapshot.holdings) {
    if (h.ticker) m.set(h.ticker, h);
  }
  return m;
}

/**
 * Derive transactions by diffing each consecutive pair of monthly snapshots.
 *
 * Heuristics:
 * - new ticker → NEW_BUY (or REBUY if the ticker existed in any older snapshot then disappeared)
 * - removed ticker → EXIT
 * - qty up → INCREASE (or REBUY if cost basis was also reset, which means the position was
 *   actually sold then reopened — Flagstone reports keep the original cost basis intact)
 * - qty down → DECREASE
 *
 * Price estimates:
 * - For BUYs we use the cost-basis change divided by the quantity change.
 * - For SELLs we use the previous snapshot's marketValue / quantity (best available proxy).
 */
export function deriveTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  const everSeen = new Set<string>();

  for (let i = 1; i < SNAPSHOTS.length; i++) {
    const prev = SNAPSHOTS[i - 1];
    const curr = SNAPSHOTS[i];
    const prevMap = indexByTicker(prev);
    const currMap = indexByTicker(curr);

    // First pass: record everSeen from the older snapshots
    for (const t of prevMap.keys()) everSeen.add(t);

    const tickers = new Set<string>([...prevMap.keys(), ...currMap.keys()]);

    for (const ticker of tickers) {
      const before = prevMap.get(ticker);
      const after = currMap.get(ticker);

      if (!before && after) {
        // New position this period — could be a fresh buy or a rebuy of something
        // we used to own. Distinguish by whether we've seen this ticker before.
        const action: TransactionAction = everSeen.has(ticker) ? "REBUY" : "NEW_BUY";
        const price = after.quantity > 0 ? after.purchaseCost / after.quantity : null;
        const cashFlow = -after.purchaseCost; // outflow
        txns.push({
          id: `${curr.monthKey}-${ticker}-${action}`,
          monthKey: curr.monthKey,
          asOf: curr.asOf,
          ticker,
          name: after.name,
          action,
          sharesBefore: 0,
          sharesAfter: after.quantity,
          sharesDelta: after.quantity,
          estimatedPrice: price,
          estimatedCashFlow: cashFlow,
          member: after.member,
          assetClass: after.assetClass,
        });
      } else if (before && !after) {
        // Exit
        const price = before.quantity > 0 ? before.marketValue / before.quantity : null;
        const cashFlow = price !== null ? price * before.quantity : null; // inflow
        txns.push({
          id: `${curr.monthKey}-${ticker}-EXIT`,
          monthKey: curr.monthKey,
          asOf: curr.asOf,
          ticker,
          name: before.name,
          action: "EXIT",
          sharesBefore: before.quantity,
          sharesAfter: 0,
          sharesDelta: -before.quantity,
          estimatedPrice: price,
          estimatedCashFlow: cashFlow,
          member: before.member,
          assetClass: before.assetClass,
        });
      } else if (before && after) {
        // Same ticker in both snapshots — look for quantity or cost-basis changes
        if (after.quantity === before.quantity) continue;

        const qtyDelta = after.quantity - before.quantity;
        const costDelta = after.purchaseCost - before.purchaseCost;

        if (qtyDelta > 0) {
          // INCREASE — use cost-basis delta divided by share delta for buy price
          const price = costDelta > 0 && qtyDelta > 0 ? costDelta / qtyDelta : null;
          const cashFlow = -Math.max(costDelta, 0);
          txns.push({
            id: `${curr.monthKey}-${ticker}-INCREASE`,
            monthKey: curr.monthKey,
            asOf: curr.asOf,
            ticker,
            name: after.name,
            action: "INCREASE",
            sharesBefore: before.quantity,
            sharesAfter: after.quantity,
            sharesDelta: qtyDelta,
            estimatedPrice: price,
            estimatedCashFlow: cashFlow,
            member: after.member,
            assetClass: after.assetClass,
          });
        } else {
          // DECREASE — sell price ≈ prior snapshot's marketValue / qty
          const price = before.quantity > 0 ? before.marketValue / before.quantity : null;
          const cashFlow = price !== null ? -qtyDelta * price : null;
          txns.push({
            id: `${curr.monthKey}-${ticker}-DECREASE`,
            monthKey: curr.monthKey,
            asOf: curr.asOf,
            ticker,
            name: after.name,
            action: "DECREASE",
            sharesBefore: before.quantity,
            sharesAfter: after.quantity,
            sharesDelta: qtyDelta,
            estimatedPrice: price,
            estimatedCashFlow: cashFlow,
            member: before.member,
            assetClass: before.assetClass,
          });
        }
      }
    }
  }

  // Sort newest first
  txns.sort((a, b) => b.monthKey.localeCompare(a.monthKey) || a.ticker.localeCompare(b.ticker));
  return txns;
}

export type Rating = "smart" | "solid" | "meh" | "oof" | "yikes" | "unknown";

export type RatedTransaction = Transaction & {
  currentPrice: number | null;
  priceChangePct: number | null;
  rating: Rating;
  ratingLabel: string;
  ratingEmoji: string;
  ratingExplanation: string;
};

/**
 * Apply a "smart move" rating to each transaction given today's prices.
 *
 * The framing depends on the action:
 *  - BUY (NEW_BUY/REBUY/INCREASE): rating goes UP when the stock has gone up since the buy.
 *  - SELL (EXIT/DECREASE): rating goes UP when the stock has gone DOWN since the sale —
 *    i.e., you got out before a decline.
 */
export function rateTransactions(
  txns: Transaction[],
  currentPrices: Record<string, number | null>,
): RatedTransaction[] {
  return txns.map((t) => {
    const price = currentPrices[t.ticker] ?? null;
    let pct: number | null = null;
    let rating: Rating = "unknown";
    let label = "Pending";
    let emoji = "⏳";
    let explanation = "No current price available.";

    if (price !== null && t.estimatedPrice !== null && t.estimatedPrice > 0) {
      const move = ((price - t.estimatedPrice) / t.estimatedPrice) * 100;
      const isBuy = t.action === "NEW_BUY" || t.action === "REBUY" || t.action === "INCREASE";
      // For sells, a price decline is favorable, so flip the sign of the "goodness" metric.
      const favorable = isBuy ? move : -move;
      pct = move;

      if (favorable >= 30) {
        rating = "smart";
        label = "Smart Move";
        emoji = "🎯";
      } else if (favorable >= 10) {
        rating = "solid";
        label = "Solid";
        emoji = "👌";
      } else if (favorable >= -10) {
        rating = "meh";
        label = "Meh";
        emoji = "🤔";
      } else if (favorable >= -30) {
        rating = "oof";
        label = "Oof";
        emoji = "😬";
      } else {
        rating = "yikes";
        label = "Yikes";
        emoji = "🤦";
      }

      if (isBuy) {
        explanation =
          move >= 0
            ? `Bought at ~$${t.estimatedPrice.toFixed(0)}, now $${price.toFixed(0)} — up ${move.toFixed(1)}%.`
            : `Bought at ~$${t.estimatedPrice.toFixed(0)}, now $${price.toFixed(0)} — down ${Math.abs(move).toFixed(1)}%.`;
      } else {
        explanation =
          move <= 0
            ? `Sold around $${t.estimatedPrice.toFixed(0)}; now $${price.toFixed(0)} — dodged a ${Math.abs(move).toFixed(1)}% drop.`
            : `Sold around $${t.estimatedPrice.toFixed(0)}; now $${price.toFixed(0)} — left ${move.toFixed(1)}% on the table.`;
      }
    }

    return {
      ...t,
      currentPrice: price,
      priceChangePct: pct,
      rating,
      ratingLabel: label,
      ratingEmoji: emoji,
      ratingExplanation: explanation,
    };
  });
}

export function uniqueTickers(txns: Transaction[]): string[] {
  return Array.from(new Set(txns.map((t) => t.ticker))).sort();
}
