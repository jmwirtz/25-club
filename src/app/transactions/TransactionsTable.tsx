"use client";

import { useMemo, useState } from "react";
import type { RatedTransaction } from "@/lib/transactions";

type SortKey = "monthKey" | "ticker" | "action" | "sharesDelta" | "estimatedPrice" | "currentPrice" | "priceChangePct" | "rating";
type SortDir = "asc" | "desc";

const RATING_RANK: Record<string, number> = {
  smart: 5, solid: 4, meh: 3, oof: 2, yikes: 1, unknown: 0,
};

const ACTIONS: Array<{ key: string; label: string }> = [
  { key: "All", label: "All actions" },
  { key: "BUY", label: "Buys (new + add)" },
  { key: "SELL", label: "Sells (exit + trim)" },
  { key: "NEW_BUY", label: "New positions" },
  { key: "REBUY", label: "Rebought after exit" },
  { key: "INCREASE", label: "Added shares" },
  { key: "DECREASE", label: "Sold some shares" },
  { key: "EXIT", label: "Fully exited" },
];

const RATINGS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "All", label: "All ratings", emoji: "" },
  { key: "smart", label: "Smart Move", emoji: "🎯" },
  { key: "solid", label: "Solid", emoji: "👌" },
  { key: "meh", label: "Meh", emoji: "🤔" },
  { key: "oof", label: "Oof", emoji: "😬" },
  { key: "yikes", label: "Yikes", emoji: "🤦" },
];

const ACTION_COLOR: Record<string, string> = {
  NEW_BUY: "bg-emerald-100 text-emerald-800",
  REBUY: "bg-emerald-100 text-emerald-800",
  INCREASE: "bg-emerald-100 text-emerald-800",
  DECREASE: "bg-rose-100 text-rose-800",
  EXIT: "bg-rose-100 text-rose-800",
};

const RATING_COLOR: Record<string, string> = {
  smart: "bg-emerald-100 text-emerald-800 border-emerald-200",
  solid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  meh: "bg-slate-100 text-slate-700 border-slate-200",
  oof: "bg-amber-100 text-amber-800 border-amber-200",
  yikes: "bg-rose-100 text-rose-800 border-rose-200",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

export function TransactionsTable({ transactions }: { transactions: RatedTransaction[] }) {
  const [filter, setFilter] = useState("");
  const [action, setAction] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [member, setMember] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("monthKey");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const members = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((t) => { if (t.member) s.add(t.member); });
    return ["All", ...Array.from(s).sort()];
  }, [transactions]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = transactions.filter((t) => {
      if (member !== "All" && t.member !== member) return false;
      if (ratingFilter !== "All" && t.rating !== ratingFilter) return false;
      if (action !== "All") {
        if (action === "BUY") {
          if (!(t.action === "NEW_BUY" || t.action === "REBUY" || t.action === "INCREASE")) return false;
        } else if (action === "SELL") {
          if (!(t.action === "EXIT" || t.action === "DECREASE")) return false;
        } else if (t.action !== action) return false;
      }
      if (!q) return true;
      return (
        t.ticker.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.member ?? "").toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "rating") return (RATING_RANK[b.rating] - RATING_RANK[a.rating]) * (dir === 1 ? -1 : 1);
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [transactions, filter, action, ratingFilter, member, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "ticker" || k === "action" ? "asc" : "desc");
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-medium">{visible.length} transactions</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search ticker, name, member…"
            className="px-3 py-1.5 border border-slate-300 rounded text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {RATINGS.map((r) => <option key={r.key} value={r.key}>{r.emoji ? `${r.emoji} ` : ""}{r.label}</option>)}
          </select>
          <select value={member} onChange={(e) => setMember(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {members.map((m) => <option key={m} value={m}>{m === "All" ? "All members" : m}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 select-none">
            <tr>
              <Th sortKey="monthKey" current={sortKey} dir={sortDir} onClick={toggleSort}>Month</Th>
              <Th sortKey="action" current={sortKey} dir={sortDir} onClick={toggleSort}>Action</Th>
              <Th sortKey="ticker" current={sortKey} dir={sortDir} onClick={toggleSort}>Ticker</Th>
              <Th sortKey="sharesDelta" current={sortKey} dir={sortDir} onClick={toggleSort} right>Shares</Th>
              <Th sortKey="estimatedPrice" current={sortKey} dir={sortDir} onClick={toggleSort} right>At ~</Th>
              <Th sortKey="currentPrice" current={sortKey} dir={sortDir} onClick={toggleSort} right>Now</Th>
              <Th sortKey="priceChangePct" current={sortKey} dir={sortDir} onClick={toggleSort} right>Move Since</Th>
              <Th sortKey="rating" current={sortKey} dir={sortDir} onClick={toggleSort}>Rating</Th>
              <th className="px-3 py-2 text-left font-medium">Member</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No transactions match your filters.
                </td>
              </tr>
            )}
            {visible.map((t) => {
              const isBuy = t.action === "NEW_BUY" || t.action === "REBUY" || t.action === "INCREASE";
              const moveColor = t.priceChangePct === null ? "" : t.priceChangePct >= 0 ? "text-emerald-700" : "text-rose-700";
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50" title={t.ratingExplanation}>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-700 text-xs">{t.monthKey}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLOR[t.action] ?? "bg-slate-100"}`}>
                      {actionLabel(t.action)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono font-medium">{t.ticker}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{t.name}</div>
                  </td>
                  <td className={`px-3 py-2 text-right ${isBuy ? "text-emerald-700" : "text-rose-700"}`}>
                    {isBuy ? "+" : ""}{t.sharesDelta.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">{t.estimatedPrice !== null ? `$${t.estimatedPrice.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2 text-right">{t.currentPrice !== null ? `$${t.currentPrice.toFixed(2)}` : "—"}</td>
                  <td className={`px-3 py-2 text-right ${moveColor}`}>
                    {t.priceChangePct !== null ? `${t.priceChangePct >= 0 ? "+" : ""}${t.priceChangePct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${RATING_COLOR[t.rating]}`}
                      title={t.ratingExplanation}
                    >
                      <span>{t.ratingEmoji}</span>
                      <span>{t.ratingLabel}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{t.member ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case "NEW_BUY": return "New Buy";
    case "REBUY": return "Rebuy";
    case "INCREASE": return "Added";
    case "DECREASE": return "Trimmed";
    case "EXIT": return "Exited";
    default: return a;
  }
}

function Th({ children, sortKey: key, current, dir, onClick, right }: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = current === key;
  return (
    <th onClick={() => onClick(key)} className={`px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 ${right ? "text-right" : "text-left"}`}>
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[10px] ${active ? "text-slate-700" : "text-slate-300"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}
