"use client";

import { useState } from "react";
import type { StockSnapshot } from "@/lib/prices";

type Result = {
  snapshot: StockSnapshot;
  alreadyHeld: { quantity: number; member: string | null; gainLossPct: number | null } | null;
  analysis: string;
};

export default function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? `Request failed (${res.status})`);
      else setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analyze a Stock</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter a company name (e.g. &quot;Costco&quot;) or ticker (e.g. &quot;COST&quot;). The app pulls live
          fundamentals and Claude analyzes the idea in the context of the club&apos;s current portfolio.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Company name or ticker — Costco, COST, Palantir, PLTR…"
          className="flex-1 px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-slate-500">
          Resolving ticker, pulling live fundamentals, and asking Claude. ~15–20 seconds.
        </div>
      )}

      {result && (
        <>
          <SnapshotCard snapshot={result.snapshot} alreadyHeld={result.alreadyHeld} />
          <article className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-base font-semibold mb-4 pb-2 border-b border-slate-100">AI Analysis</h2>
            <Markdown text={result.analysis} />
          </article>
        </>
      )}
    </div>
  );
}

function SnapshotCard({
  snapshot,
  alreadyHeld,
}: {
  snapshot: StockSnapshot;
  alreadyHeld: Result["alreadyHeld"];
}) {
  const dayPos = (snapshot.dayChangePct ?? 0) >= 0;
  const yrPos = (snapshot.fiftyTwoWeekChange ?? 0) >= 0;
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-xl font-semibold font-mono">{snapshot.symbol}</h2>
            <span className="text-slate-700">{snapshot.name}</span>
            <span className="text-xs text-slate-500">{snapshot.exchange}</span>
          </div>
          {snapshot.sector && (
            <div className="text-xs text-slate-500 mt-1">
              {snapshot.sector}
              {snapshot.industry ? ` · ${snapshot.industry}` : ""}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">${snapshot.price.toFixed(2)}</div>
          {snapshot.dayChange !== null && snapshot.dayChangePct !== null && (
            <div className={`text-sm ${dayPos ? "text-emerald-700" : "text-rose-700"}`}>
              {dayPos ? "+" : ""}
              {snapshot.dayChange.toFixed(2)} ({dayPos ? "+" : ""}
              {snapshot.dayChangePct.toFixed(2)}%) today
            </div>
          )}
        </div>
      </div>

      {alreadyHeld && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
          <span className="font-medium">Already in portfolio:</span>
          <span>{alreadyHeld.quantity} shares</span>
          {alreadyHeld.member && <span>· point: {alreadyHeld.member}</span>}
          {alreadyHeld.gainLossPct !== null && (
            <span className={alreadyHeld.gainLossPct >= 0 ? "text-emerald-700" : "text-rose-700"}>
              · {alreadyHeld.gainLossPct >= 0 ? "+" : ""}
              {alreadyHeld.gainLossPct.toFixed(1)}% lifetime
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
        <Stat label="Market Cap" value={fmtBig(snapshot.marketCap)} />
        <Stat label="Trailing P/E" value={fmtNum(snapshot.trailingPE, 1)} />
        <Stat label="Forward P/E" value={fmtNum(snapshot.forwardPE, 1)} />
        <Stat label="PEG Ratio" value={fmtNum(snapshot.pegRatio, 2)} />
        <Stat
          label="Dividend Yield"
          value={snapshot.dividendYield !== null ? `${(snapshot.dividendYield * 100).toFixed(2)}%` : "—"}
        />
        <Stat label="Beta" value={fmtNum(snapshot.beta, 2)} />
        <Stat
          label="1-Year Change"
          value={
            snapshot.fiftyTwoWeekChange !== null
              ? `${yrPos ? "+" : ""}${(snapshot.fiftyTwoWeekChange * 100).toFixed(1)}%`
              : "—"
          }
          tone={snapshot.fiftyTwoWeekChange !== null ? (yrPos ? "pos" : "neg") : undefined}
        />
        <Stat
          label="52-Week Range"
          value={
            snapshot.fiftyTwoWeekLow !== null && snapshot.fiftyTwoWeekHigh !== null
              ? `$${snapshot.fiftyTwoWeekLow.toFixed(0)} – $${snapshot.fiftyTwoWeekHigh.toFixed(0)}`
              : "—"
          }
        />
        <Stat
          label="Net Margin"
          value={snapshot.profitMargin !== null ? `${(snapshot.profitMargin * 100).toFixed(1)}%` : "—"}
        />
        <Stat label="Revenue (TTM)" value={fmtBig(snapshot.revenue)} />
        <Stat
          label="Analyst Target"
          value={snapshot.targetMeanPrice !== null ? `$${snapshot.targetMeanPrice.toFixed(0)}` : "—"}
          sub={
            snapshot.targetMeanPrice !== null
              ? `${((snapshot.targetMeanPrice / snapshot.price - 1) * 100 >= 0 ? "+" : "") + ((snapshot.targetMeanPrice / snapshot.price - 1) * 100).toFixed(1)}% vs price`
              : undefined
          }
        />
        <Stat
          label="Recommendation"
          value={snapshot.recommendation ? cap(snapshot.recommendation) : "—"}
        />
      </div>

      {snapshot.fiftyTwoWeekLow !== null && snapshot.fiftyTwoWeekHigh !== null && (
        <div className="mt-5">
          <div className="text-xs text-slate-500 mb-1.5 flex justify-between">
            <span>52-week low: ${snapshot.fiftyTwoWeekLow.toFixed(2)}</span>
            <span>52-week high: ${snapshot.fiftyTwoWeekHigh.toFixed(2)}</span>
          </div>
          <RangeBar
            low={snapshot.fiftyTwoWeekLow}
            high={snapshot.fiftyTwoWeekHigh}
            price={snapshot.price}
          />
        </div>
      )}
    </section>
  );
}

function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
  const pct = high === low ? 50 : Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return (
    <div className="relative h-2 bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-200 rounded">
      <div
        className="absolute -top-1 w-1 h-4 bg-slate-900 rounded"
        style={{ left: `calc(${pct}% - 2px)` }}
        title={`Current: $${price.toFixed(2)} (${pct.toFixed(0)}% of range)`}
      />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded border border-slate-200 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 font-medium ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function fmtBig(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(n: number | null, digits = 1): string {
  if (n === null) return "—";
  return n.toFixed(digits);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n(?=## )/);
  return (
    <div className="prose prose-slate max-w-none">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const head = lines[0];
        if (head.startsWith("## ")) {
          const heading = head.replace(/^## /, "");
          const body = lines.slice(1).join("\n").trim();
          return (
            <section key={i} className="mb-6">
              <h3 className="text-base font-semibold text-slate-900 mb-2">{heading}</h3>
              <Body text={body} />
            </section>
          );
        }
        return <Body key={i} text={block} />;
      })}
    </div>
  );
}

function Body({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((p, i) => {
        const lines = p.split("\n");
        const isList = lines.every((ln) => /^\s*[-*]\s+/.test(ln));
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-6 space-y-1 text-sm text-slate-700 mb-3">
              {lines.map((ln, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(ln.replace(/^\s*[-*]\s+/, "")) }} />
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="text-sm text-slate-700 mb-3 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: inlineMd(p) }}
          />
        );
      })}
    </>
  );
}

function inlineMd(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded text-xs">$1</code>');
}
