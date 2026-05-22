"use client";

import { useState } from "react";

type Result = {
  ticker: string;
  price: number;
  currency: string;
  alreadyHeld: boolean;
  analysis: string;
};

export default function AnalyzePage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`);
      } else {
        setResult(data);
      }
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
          Enter a ticker. Claude will analyze it in the context of the club&apos;s current portfolio
          and suggest discussion hooks for the next meeting.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g. PLTR, COST, SHOP"
          className="flex-1 px-4 py-2 border border-slate-300 rounded-md font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={10}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
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
          Pulling live prices, building portfolio context, and asking Claude. This takes ~10–20 seconds.
        </div>
      )}

      {result && (
        <article className="bg-white border border-slate-200 rounded-lg p-6">
          <header className="mb-4 pb-4 border-b border-slate-100">
            <h2 className="text-xl font-semibold font-mono">{result.ticker}</h2>
            <div className="text-sm text-slate-500 mt-1">
              Price: ${result.price.toFixed(2)} {result.currency}
              {result.alreadyHeld && (
                <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                  Already held
                </span>
              )}
            </div>
          </header>
          <Markdown text={result.analysis} />
        </article>
      )}
    </div>
  );
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
