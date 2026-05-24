"use client";

import { useMemo, useState } from "react";
import type { MemberStats } from "@/lib/leaderboard";

type SortKey =
  | "rank"
  | "member"
  | "positionCount"
  | "totalCost"
  | "totalMarketValue"
  | "totalGain"
  | "totalGainPct"
  | "shareOfClubGain"
  | "averageHoldYears";

type SortDir = "asc" | "desc";

export function MembersTable({ stats }: { stats: MemberStats[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalGain");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // The rank is by totalGain DESCENDING regardless of current sort
  const rankMap = useMemo(() => {
    const ranked = [...stats].sort((a, b) => b.totalGain - a.totalGain);
    const map = new Map<string, number>();
    ranked.forEach((s, i) => map.set(s.member, i + 1));
    return map;
  }, [stats]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...stats].sort((a, b) => {
      if (sortKey === "rank") return (rankMap.get(a.member)! - rankMap.get(b.member)!) * dir;
      if (sortKey === "member") return a.member.localeCompare(b.member) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [stats, sortKey, sortDir, rankMap]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "member" ? "asc" : "desc");
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 select-none">
          <tr>
            <Th sortKey="rank" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-12">#</Th>
            <Th sortKey="member" current={sortKey} dir={sortDir} onClick={toggleSort}>Member</Th>
            <Th sortKey="positionCount" current={sortKey} dir={sortDir} onClick={toggleSort} right>Picks</Th>
            <Th sortKey="totalCost" current={sortKey} dir={sortDir} onClick={toggleSort} right>Cost Basis</Th>
            <Th sortKey="totalMarketValue" current={sortKey} dir={sortDir} onClick={toggleSort} right>Market Value</Th>
            <Th sortKey="totalGain" current={sortKey} dir={sortDir} onClick={toggleSort} right>$ Gain</Th>
            <Th sortKey="totalGainPct" current={sortKey} dir={sortDir} onClick={toggleSort} right>% Gain</Th>
            <Th sortKey="shareOfClubGain" current={sortKey} dir={sortDir} onClick={toggleSort} right>% of Club Gain</Th>
            <Th sortKey="averageHoldYears" current={sortKey} dir={sortDir} onClick={toggleSort} right>Avg Hold</Th>
            <th className="px-3 py-2 text-left font-medium">Best Pick</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const rank = rankMap.get(s.member)!;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
            return (
              <tr key={s.member} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500 text-center">{medal || rank}</td>
                <td className="px-3 py-2 font-medium">{s.member}</td>
                <td className="px-3 py-2 text-right">{s.positionCount}</td>
                <td className="px-3 py-2 text-right">{fmt$(s.totalCost)}</td>
                <td className="px-3 py-2 text-right">{fmt$(s.totalMarketValue)}</td>
                <td className={`px-3 py-2 text-right font-medium ${s.totalGain >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {s.totalGain >= 0 ? "+" : ""}
                  {fmt$(s.totalGain)}
                </td>
                <td className={`px-3 py-2 text-right ${s.totalGainPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {s.totalGainPct >= 0 ? "+" : ""}
                  {s.totalGainPct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {(s.shareOfClubGain * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {s.averageHoldYears.toFixed(1)} yrs
                </td>
                <td className="px-3 py-2 text-slate-600 text-xs">
                  {s.bestPick ? (
                    <>
                      <span className="font-mono font-medium">{s.bestPick.ticker}</span>{" "}
                      <span className={s.bestPick.gainPct >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        ({s.bestPick.gainPct >= 0 ? "+" : ""}
                        {s.bestPick.gainPct.toFixed(0)}%)
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  sortKey: key,
  current,
  dir,
  onClick,
  right,
  className = "",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  right?: boolean;
  className?: string;
}) {
  const active = current === key;
  return (
    <th
      onClick={() => onClick(key)}
      className={`px-3 py-2 font-medium cursor-pointer hover:bg-slate-100 ${right ? "text-right" : "text-left"} ${className}`}
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

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
