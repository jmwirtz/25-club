"use client";

import { useMemo, useState } from "react";
import type { EnrichedHolding } from "@/lib/types";

type SortKey =
  | "ticker"
  | "name"
  | "assetClass"
  | "quantity"
  | "avgCost"
  | "currentPrice"
  | "marketValue"
  | "gainLoss"
  | "gainLossPct"
  | "annualizedReturnPct"
  | "member"
  | "originalDOP";

type SortDir = "asc" | "desc";

export function HoldingsTable({ holdings }: { holdings: EnrichedHolding[] }) {
  const [filter, setFilter] = useState("");
  const [assetClass, setAssetClass] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const classes = useMemo(() => {
    const set = new Set<string>();
    holdings.forEach((h) => set.add(h.assetClass));
    return ["All", ...Array.from(set).sort()];
  }, [holdings]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = holdings.filter((h) => {
      if (assetClass !== "All" && h.assetClass !== assetClass) return false;
      if (!q) return true;
      return (
        h.ticker.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        (h.member ?? "").toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [holdings, filter, assetClass, sortKey, sortDir]);

  function setSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "name" || key === "assetClass" || key === "member" ? "asc" : "desc");
    }
  }

  const filteredCost = visible.reduce((s, h) => s + (h.marketValue !== null ? h.purchaseCost : 0), 0);
  const filteredMV = visible.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const filteredGL = filteredMV - filteredCost;

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-medium">Holdings ({visible.length} of {holdings.length})</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search ticker, name, member…"
            className="px-3 py-1.5 border border-slate-300 rounded text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {(filter || assetClass !== "All") && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          Filtered total: <strong>{fmtCurrency(filteredMV)}</strong> ·
          {" "}cost <strong>{fmtCurrency(filteredCost)}</strong> ·
          {" "}<span className={filteredGL >= 0 ? "text-emerald-700" : "text-rose-700"}>
            {filteredGL >= 0 ? "+" : ""}{fmtCurrency(filteredGL)}
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 select-none">
            <tr>
              <Th sortKey="ticker" current={sortKey} dir={sortDir} onClick={setSort}>Ticker</Th>
              <Th sortKey="name" current={sortKey} dir={sortDir} onClick={setSort}>Name</Th>
              <Th sortKey="assetClass" current={sortKey} dir={sortDir} onClick={setSort}>Class</Th>
              <Th sortKey="originalDOP" current={sortKey} dir={sortDir} onClick={setSort}>Held Since</Th>
              <Th sortKey="quantity" current={sortKey} dir={sortDir} onClick={setSort} right>Qty</Th>
              <Th sortKey="avgCost" current={sortKey} dir={sortDir} onClick={setSort} right>Avg Cost</Th>
              <Th sortKey="currentPrice" current={sortKey} dir={sortDir} onClick={setSort} right>Price</Th>
              <Th sortKey="marketValue" current={sortKey} dir={sortDir} onClick={setSort} right>Market Value</Th>
              <Th sortKey="gainLoss" current={sortKey} dir={sortDir} onClick={setSort} right>Gain/Loss</Th>
              <Th sortKey="gainLossPct" current={sortKey} dir={sortDir} onClick={setSort} right>Total %</Th>
              <Th sortKey="annualizedReturnPct" current={sortKey} dir={sortDir} onClick={setSort} right>Ann. %</Th>
              <Th sortKey="member" current={sortKey} dir={sortDir} onClick={setSort}>Point</Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                  No holdings match your filters.
                </td>
              </tr>
            )}
            {visible.map((h) => (
              <tr key={h.ticker} className="border-t border-slate-100 hover:bg-slate-50">
                <Td className="font-mono font-medium">{h.ticker}</Td>
                <Td>{h.name}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">{h.assetClass}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">{h.originalDOP}</Td>
                <Td className="text-right">{h.quantity.toLocaleString()}</Td>
                <Td className="text-right">{fmtCurrency(h.avgCost, 2)}</Td>
                <Td className="text-right">{fmtCurrency(h.currentPrice, 2)}</Td>
                <Td className="text-right">{fmtCurrency(h.marketValue)}</Td>
                <Td className={`text-right ${h.gainLoss === null ? "" : h.gainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {fmtCurrency(h.gainLoss)}
                </Td>
                <Td className={`text-right ${h.gainLossPct === null ? "" : h.gainLossPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {h.gainLossPct !== null ? `${h.gainLossPct >= 0 ? "+" : ""}${h.gainLossPct.toFixed(1)}%` : "—"}
                </Td>
                <Td className={`text-right ${h.annualizedReturnPct === null ? "" : h.annualizedReturnPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {h.annualizedReturnPct !== null ? `${h.annualizedReturnPct >= 0 ? "+" : ""}${h.annualizedReturnPct.toFixed(1)}%` : "—"}
                </Td>
                <Td className="text-slate-600">{h.member ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  sortKey: key,
  current,
  dir,
  onClick,
  right,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  right?: boolean;
}) {
  const active = current === key;
  return (
    <th
      onClick={() => onClick(key)}
      className={`px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 ${right ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[10px] ${active ? "text-slate-700" : "text-slate-300"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function fmtCurrency(n: number | null, digits = 0): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
}
