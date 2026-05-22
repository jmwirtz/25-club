import { getEnrichedPortfolio } from "@/lib/portfolio";
import {
  CASH_BALANCE,
  HISTORICAL_RETURNS,
  MMKT_BALANCE,
  PORTFOLIO_AS_OF,
} from "@/lib/holdings";

export const revalidate = 300; // refresh prices every 5 min

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
  const sorted = [...holdings].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));

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
        <Stat
          label="Cost Basis (priced)"
          value={fmtCurrency(totals.purchaseCost)}
        />
        <Stat
          label="Unrealized Gain/Loss"
          value={`${fmtCurrency(totals.gainLoss)} (${fmtPct(totals.gainLossPct)})`}
          tone={totals.gainLoss >= 0 ? "pos" : "neg"}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-medium">Holdings ({totals.total})</h2>
          <span className="text-xs text-slate-500">
            {totals.priced}/{totals.total} live-priced
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>Ticker</Th>
                <Th>Name</Th>
                <Th>Class</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Avg Cost</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Market Value</Th>
                <Th className="text-right">Gain/Loss</Th>
                <Th>Point</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr key={h.ticker} className="border-t border-slate-100 hover:bg-slate-50">
                  <Td className="font-mono font-medium">{h.ticker}</Td>
                  <Td>{h.name}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">{h.assetClass}</Td>
                  <Td className="text-right">{h.quantity.toLocaleString()}</Td>
                  <Td className="text-right">{fmtCurrency(h.avgCost, { maximumFractionDigits: 2 })}</Td>
                  <Td className="text-right">{fmtCurrency(h.currentPrice, { maximumFractionDigits: 2 })}</Td>
                  <Td className="text-right">{fmtCurrency(h.marketValue)}</Td>
                  <Td className={`text-right ${h.gainLoss === null ? "" : h.gainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {fmtCurrency(h.gainLoss)} <span className="text-xs">({fmtPct(h.gainLossPct)})</span>
                  </Td>
                  <Td className="text-slate-600">{h.member ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium">Historical Annual Returns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>Year</Th>
                <Th className="text-right">25 Club</Th>
                <Th className="text-right">S&P 500</Th>
                <Th className="text-right">DJIA</Th>
                <Th className="text-right">NASDAQ 100</Th>
                <Th className="text-right">vs S&P</Th>
              </tr>
            </thead>
            <tbody>
              {HISTORICAL_RETURNS.slice().reverse().map((r) => {
                const beat = r.club !== null ? r.club - r.sp500 : null;
                return (
                  <tr key={r.year} className="border-t border-slate-100">
                    <Td className="font-medium">{r.year}</Td>
                    <Td className={`text-right ${r.club !== null && r.club >= 0 ? "text-emerald-700" : r.club !== null ? "text-rose-700" : ""}`}>
                      {r.club !== null ? `${r.club.toFixed(2)}%` : "—"}
                    </Td>
                    <Td className="text-right">{r.sp500.toFixed(2)}%</Td>
                    <Td className="text-right">{r.djia.toFixed(2)}%</Td>
                    <Td className="text-right">{r.nasdaq100.toFixed(2)}%</Td>
                    <Td className={`text-right ${beat !== null && beat >= 0 ? "text-emerald-700" : beat !== null ? "text-rose-700" : ""}`}>
                      {beat !== null ? `${beat > 0 ? "+" : ""}${beat.toFixed(2)} pp` : "—"}
                    </Td>
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
