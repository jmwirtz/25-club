import Link from "next/link";
import { getEnrichedPortfolio } from "@/lib/portfolio";
import { computeMemberStats } from "@/lib/leaderboard";
import { CASH_BALANCE, HISTORICAL_RETURNS, MMKT_BALANCE, PORTFOLIO_AS_OF } from "@/lib/holdings";

export const revalidate = 300;

export default async function Home() {
  const { holdings, totals } = await getEnrichedPortfolio();
  const { stats, awards } = computeMemberStats(holdings);

  const totalWithCash = totals.marketValue + CASH_BALANCE + MMKT_BALANCE;
  const ytd = HISTORICAL_RETURNS[HISTORICAL_RETURNS.length - 1];

  const topGainers = [...holdings]
    .filter((h) => h.gainLossPct !== null)
    .sort((a, b) => (b.gainLossPct ?? 0) - (a.gainLossPct ?? 0))
    .slice(0, 3);

  const topLosers = [...holdings]
    .filter((h) => h.gainLossPct !== null)
    .sort((a, b) => (a.gainLossPct ?? 0) - (b.gainLossPct ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">25 Club</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Portfolio dashboard and AI-assisted stock analysis for the club.
          Live prices via Yahoo Finance, analysis powered by Claude.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Market Value" value={fmt$(totalWithCash)} sub={`as of ${PORTFOLIO_AS_OF} report + live prices`} />
        <Stat
          label="Unrealized Gain"
          value={`${totals.gainLoss >= 0 ? "+" : ""}${fmt$(totals.gainLoss)}`}
          sub={`${totals.gainLossPct >= 0 ? "+" : ""}${totals.gainLossPct.toFixed(1)}% vs cost basis`}
          tone={totals.gainLoss >= 0 ? "pos" : "neg"}
        />
        <Stat
          label={`${ytd.year} YTD (Club)`}
          value={ytd.club !== null ? `${ytd.club >= 0 ? "+" : ""}${ytd.club.toFixed(2)}%` : "—"}
          sub={`S&P 500: ${ytd.sp500.toFixed(2)}%`}
          tone={ytd.club !== null && ytd.club >= 0 ? "pos" : "neg"}
        />
        <Stat
          label="Positions"
          value={`${holdings.length}`}
          sub={`across ${stats.length} members`}
        />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <NavCard
          href="/portfolio"
          title="Portfolio"
          description="All current holdings with live prices, gain/loss, and historical returns vs the major indices. Sort and filter to drill in."
        />
        <NavCard
          href="/analyze"
          title="Analyze a Stock"
          description="Enter a company name or ticker. Get key fundamentals plus an AI analysis tailored to the club's existing portfolio and members."
        />
        <NavCard
          href="/members"
          title="Member Standings"
          description="Leaderboard of who picked what, and how their picks have performed. Awards for biggest gainers, longest holds, and more."
        />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <MoversCard title="Top Gainers" emoji="🚀" holdings={topGainers} tone="pos" />
        <MoversCard title="Top Laggards" emoji="🥶" holdings={topLosers} tone="neg" />
      </section>

      {awards.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">
            Quick Hall of Fame
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {awards.slice(0, 6).map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-2">
                <div className="text-2xl leading-none">{a.emoji}</div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{a.title}</div>
                  <div className="text-sm font-semibold">{a.member}</div>
                  <div className="text-xs text-slate-600">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs">
            <Link href="/members" className="text-blue-600 hover:underline">
              See full leaderboard →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition"
    >
      <div className="text-lg font-semibold flex items-center justify-between">
        {title}
        <span className="text-blue-600 text-sm">→</span>
      </div>
      <p className="text-sm text-slate-600 mt-2">{description}</p>
    </Link>
  );
}

function MoversCard({
  title,
  emoji,
  holdings,
  tone,
}: {
  title: string;
  emoji: string;
  holdings: Array<{ ticker: string; name: string; gainLossPct: number | null; gainLoss: number | null; member: string | null }>;
  tone: "pos" | "neg";
}) {
  const color = tone === "pos" ? "text-emerald-700" : "text-rose-700";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h3>
      <ul className="space-y-2">
        {holdings.map((h) => (
          <li key={h.ticker} className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <span className="font-mono font-medium">{h.ticker}</span>{" "}
              <span className="text-slate-500 text-xs truncate">{h.name}</span>
              {h.member && <span className="text-slate-400 text-xs ml-1">· {h.member}</span>}
            </div>
            <div className={`font-medium ${color}`}>
              {(h.gainLossPct ?? 0) >= 0 ? "+" : ""}
              {(h.gainLossPct ?? 0).toFixed(1)}%
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
