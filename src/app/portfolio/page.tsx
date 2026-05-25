import { getEnrichedPortfolio } from "@/lib/portfolio";
import {
  CASH_BALANCE,
  HISTORICAL_RETURNS,
  MMKT_BALANCE,
  PORTFOLIO_AS_OF,
} from "@/lib/holdings";
import { HoldingsTable } from "./HoldingsTable";

export const revalidate = 60;

function fmtCurrency(n: number | null, opts: Intl.NumberFormatOptions = {}) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, ...opts });
}

function fmtPct(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default async function PortfolioPage() {
  const { holdings, totals } = await getEnrichedPortfolio();
  const totalEquity = totals.marketValue;
  const totalWithCash = totalEquity + CASH_BALANCE + MMKT_BALANCE;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Positions as of report date {PORTFOLIO_AS_OF}. Prices and market values refresh live (cached 5 min).
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Market Value" value={fmtCurrency(totalWithCash)} />
        <Stat label="Equity Market Value" value={fmtCurrency(totalEquity)} />
        <Stat label="Cost Basis (priced)" value={fmtCurrency(totals.purchaseCost)} />
        <Stat
          label="Unrealized Gain/Loss"
          value={`${fmtCurrency(totals.gainLoss)} (${fmtPct(totals.gainLossPct)})`}
          tone={totals.gainLoss >= 0 ? "pos" : "neg"}
        />
      </section>

      <HoldingsTable holdings={holdings} />

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium">Historical Annual Returns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Year</th>
                <th className="px-3 py-2 text-right font-medium">25 Club</th>
                <th className="px-3 py-2 text-right font-medium">S&P 500</th>
                <th className="px-3 py-2 text-right font-medium">DJIA</th>
                <th className="px-3 py-2 text-right font-medium">NASDAQ 100</th>
                <th className="px-3 py-2 text-right font-medium">vs S&P</th>
              </tr>
            </thead>
            <tbody>
              {HISTORICAL_RETURNS.slice().reverse().map((r) => {
                const beat = r.club !== null ? r.club - r.sp500 : null;
                return (
                  <tr key={r.year} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{r.year}</td>
                    <td className={`px-3 py-2 text-right ${r.club !== null && r.club >= 0 ? "text-emerald-700" : r.club !== null ? "text-rose-700" : ""}`}>
                      {r.club !== null ? `${r.club.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.sp500.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{r.djia.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{r.nasdaq100.toFixed(2)}%</td>
                    <td className={`px-3 py-2 text-right ${beat !== null && beat >= 0 ? "text-emerald-700" : beat !== null ? "text-rose-700" : ""}`}>
                      {beat !== null ? `${beat > 0 ? "+" : ""}${beat.toFixed(2)} pp` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
