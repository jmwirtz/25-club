import { getEnrichedPortfolio } from "@/lib/portfolio";
import { computeMemberStats } from "@/lib/leaderboard";
import { MembersTable } from "./MembersTable";

export const revalidate = 60;

export default async function MembersPage() {
  const { holdings } = await getEnrichedPortfolio();
  const { stats, awards } = computeMemberStats(holdings);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Member Standings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Performance leaderboard for the 25 Club. Each member is credited with the positions
          they currently serve as point person on.
        </p>
      </div>

      {awards.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-3">
            Hall of Fame
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {awards.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl leading-none">{a.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{a.title}</div>
                    <div className="text-base font-semibold mt-0.5">{a.member}</div>
                    <div className="text-xs text-slate-600 mt-1">{a.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium">Leaderboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Toggle ranking between total $ gain and annualized return. Click any column to sort.
          </p>
        </div>
        <MembersTable stats={stats} />
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Heads up:</strong> standings reflect only *currently held* positions. Once monthly
        historical reports are imported, this page will also show exited picks, trade timing, and
        per-member trends over time.
      </section>
    </div>
  );
}
