import type { EnrichedHolding } from "./types";

export type MemberStats = {
  member: string;
  positionCount: number;
  totalCost: number;
  totalMarketValue: number;
  totalGain: number;
  totalGainPct: number;
  bestPick: { ticker: string; gainPct: number; gain: number } | null;
  worstPick: { ticker: string; gainPct: number; gain: number } | null;
  largestPosition: { ticker: string; marketValue: number } | null;
  oldestHolding: { ticker: string; dop: string } | null;
  newestHolding: { ticker: string; dop: string } | null;
  shareOfClubGain: number; // fraction of total club gain
  averageHoldYears: number;
};

export type Award = {
  id: string;
  emoji: string;
  title: string;
  member: string;
  detail: string;
};

export function computeMemberStats(holdings: EnrichedHolding[]): {
  stats: MemberStats[];
  awards: Award[];
  totalClubGain: number;
} {
  // Group by member; drop unassigned
  const byMember = new Map<string, EnrichedHolding[]>();
  for (const h of holdings) {
    if (!h.member) continue;
    if (h.marketValue === null) continue; // skip unpriced
    const arr = byMember.get(h.member) ?? [];
    arr.push(h);
    byMember.set(h.member, arr);
  }

  const totalClubGain = holdings.reduce(
    (s, h) => s + (h.gainLoss ?? 0),
    0,
  );

  const stats: MemberStats[] = Array.from(byMember.entries()).map(([member, hs]) => {
    const totalCost = hs.reduce((s, h) => s + h.purchaseCost, 0);
    const totalMarketValue = hs.reduce((s, h) => s + (h.marketValue ?? 0), 0);
    const totalGain = totalMarketValue - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    const sortedByPct = [...hs].sort((a, b) => (b.gainLossPct ?? 0) - (a.gainLossPct ?? 0));
    const sortedByMV = [...hs].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
    const sortedByDate = [...hs].sort(
      (a, b) => new Date(a.originalDOP).getTime() - new Date(b.originalDOP).getTime(),
    );

    const best = sortedByPct[0];
    const worst = sortedByPct[sortedByPct.length - 1];
    const largest = sortedByMV[0];
    const oldest = sortedByDate[0];
    const newest = sortedByDate[sortedByDate.length - 1];

    const now = new Date();
    const totalHoldYears = hs.reduce((s, h) => {
      const years = (now.getTime() - new Date(h.originalDOP).getTime()) / (365.25 * 24 * 3600 * 1000);
      return s + Math.max(0, years);
    }, 0);

    return {
      member,
      positionCount: hs.length,
      totalCost,
      totalMarketValue,
      totalGain,
      totalGainPct,
      bestPick: best ? { ticker: best.ticker, gainPct: best.gainLossPct ?? 0, gain: best.gainLoss ?? 0 } : null,
      worstPick: worst ? { ticker: worst.ticker, gainPct: worst.gainLossPct ?? 0, gain: worst.gainLoss ?? 0 } : null,
      largestPosition: largest ? { ticker: largest.ticker, marketValue: largest.marketValue ?? 0 } : null,
      oldestHolding: oldest ? { ticker: oldest.ticker, dop: oldest.originalDOP } : null,
      newestHolding: newest ? { ticker: newest.ticker, dop: newest.originalDOP } : null,
      shareOfClubGain: totalClubGain > 0 ? totalGain / totalClubGain : 0,
      averageHoldYears: hs.length > 0 ? totalHoldYears / hs.length : 0,
    };
  });

  // Awards
  const awards: Award[] = [];

  const topByDollarGain = [...stats].sort((a, b) => b.totalGain - a.totalGain)[0];
  if (topByDollarGain) {
    awards.push({
      id: "top-dollar",
      emoji: "🥇",
      title: "Biggest $ Gainer",
      member: topByDollarGain.member,
      detail: `${fmt$(topByDollarGain.totalGain)} unrealized across ${topByDollarGain.positionCount} ${topByDollarGain.positionCount === 1 ? "pick" : "picks"}`,
    });
  }

  const topByPct = [...stats].filter((s) => s.totalCost > 0).sort((a, b) => b.totalGainPct - a.totalGainPct)[0];
  if (topByPct) {
    awards.push({
      id: "top-pct",
      emoji: "🚀",
      title: "Best % Return",
      member: topByPct.member,
      detail: `+${topByPct.totalGainPct.toFixed(0)}% across portfolio`,
    });
  }

  const bestSingleAcrossClub = stats
    .filter((s) => s.bestPick)
    .sort((a, b) => (b.bestPick!.gainPct) - (a.bestPick!.gainPct))[0];
  if (bestSingleAcrossClub) {
    awards.push({
      id: "best-single",
      emoji: "🎯",
      title: "Best Single Pick",
      member: bestSingleAcrossClub.member,
      detail: `${bestSingleAcrossClub.bestPick!.ticker} +${bestSingleAcrossClub.bestPick!.gainPct.toFixed(0)}%`,
    });
  }

  const longestHolder = stats
    .filter((s) => s.oldestHolding)
    .sort((a, b) => new Date(a.oldestHolding!.dop).getTime() - new Date(b.oldestHolding!.dop).getTime())[0];
  if (longestHolder) {
    const years = Math.floor(
      (Date.now() - new Date(longestHolder.oldestHolding!.dop).getTime()) / (365.25 * 24 * 3600 * 1000),
    );
    awards.push({
      id: "longest-hold",
      emoji: "💎",
      title: "Diamond Hands",
      member: longestHolder.member,
      detail: `${longestHolder.oldestHolding!.ticker} held ${years} years (since ${longestHolder.oldestHolding!.dop})`,
    });
  }

  const mostPicks = [...stats].sort((a, b) => b.positionCount - a.positionCount)[0];
  if (mostPicks && mostPicks.positionCount > 1) {
    awards.push({
      id: "most-picks",
      emoji: "📊",
      title: "Most Active",
      member: mostPicks.member,
      detail: `${mostPicks.positionCount} positions on the books`,
    });
  }

  const worstSingleAcrossClub = stats
    .filter((s) => s.worstPick && s.worstPick.gainPct < 0)
    .sort((a, b) => (a.worstPick!.gainPct) - (b.worstPick!.gainPct))[0];
  if (worstSingleAcrossClub) {
    awards.push({
      id: "worst-single",
      emoji: "🚨",
      title: "Needs a Pep Talk",
      member: worstSingleAcrossClub.member,
      detail: `${worstSingleAcrossClub.worstPick!.ticker} ${worstSingleAcrossClub.worstPick!.gainPct.toFixed(1)}%`,
    });
  }

  // Sort stats by total gain descending by default
  stats.sort((a, b) => b.totalGain - a.totalGain);

  return { stats, awards, totalClubGain };
}

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
