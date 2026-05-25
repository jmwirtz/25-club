import { deriveTransactions, rateTransactions, uniqueTickers } from "@/lib/transactions";
import { fetchQuotes } from "@/lib/prices";
import { TransactionsTable } from "./TransactionsTable";

export const revalidate = 60;

export default async function TransactionsPage() {
  const txns = deriveTransactions();
  const tickers = uniqueTickers(txns);
  const quotes = await fetchQuotes(tickers);
  const currentPrices: Record<string, number | null> = {};
  for (const t of tickers) currentPrices[t] = quotes[t]?.price ?? null;

  const rated = rateTransactions(txns, currentPrices);

  // Summary counts
  const ratingCounts = rated.reduce<Record<string, number>>((acc, t) => {
    acc[t.rating] = (acc[t.rating] ?? 0) + 1;
    return acc;
  }, {});
  const buyCount = rated.filter((t) => t.action === "NEW_BUY" || t.action === "REBUY" || t.action === "INCREASE").length;
  const sellCount = rated.filter((t) => t.action === "EXIT" || t.action === "DECREASE").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Transaction History</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every buy, add, trim, and exit the club has made over the past two years,
          reconstructed from the monthly LPL/Flagstone reports. Each move gets a fun
          rating based on how the stock has done since.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Buys" value={buyCount.toString()} tone="pos" />
        <Stat label="Sells" value={sellCount.toString()} tone="neg" />
        <RatingStat emoji="🎯" label="Smart" count={ratingCounts.smart ?? 0} />
        <RatingStat emoji="👌" label="Solid" count={ratingCounts.solid ?? 0} />
        <RatingStat emoji="😬" label="Oof" count={ratingCounts.oof ?? 0} />
        <RatingStat emoji="🤦" label="Yikes" count={ratingCounts.yikes ?? 0} />
      </section>

      <TransactionsTable transactions={rated} />

      <section className="text-xs text-slate-500 space-y-1">
        <p>
          <strong>How the rating works:</strong> for buys, we compare the per-share
          purchase price (from the cost-basis change in the monthly reports) against
          today&apos;s live price. For sells, the rating flips — a stock that fell after
          you sold is &quot;smart,&quot; a stock that rallied is &quot;oof.&quot; Thresholds:
          ≥+30% favorable = 🎯 Smart, ≥+10% = 👌 Solid, ±10% = 🤔 Meh, –30% to –10% = 😬 Oof, ≤–30% = 🤦 Yikes.
        </p>
        <p>
          Prices update live on each page load. Transactions are derived from snapshot
          diffs, so the &quot;month&quot; reflects when the change first appeared in a report,
          not the actual trade date.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function RatingStat({ emoji, label, count }: { emoji: string; label: string; count: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
        <span>{emoji}</span> {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{count}</div>
    </div>
  );
}
