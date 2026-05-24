import YahooFinance from "yahoo-finance2";
import type { Quote } from "./types";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(tickers));
  const results = await Promise.all(
    unique.map(async (ticker): Promise<[string, Quote]> => {
      try {
        const q = (await yahooFinance.quote(ticker)) as {
          regularMarketPrice?: number;
          regularMarketPreviousClose?: number;
          currency?: string;
        } | null;
        return [
          ticker,
          {
            ticker,
            price: q?.regularMarketPrice ?? null,
            currency: q?.currency,
            previousClose: q?.regularMarketPreviousClose ?? null,
          },
        ];
      } catch (err) {
        return [
          ticker,
          { ticker, price: null, error: err instanceof Error ? err.message : "unknown" },
        ];
      }
    }),
  );
  return Object.fromEntries(results);
}

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

export async function searchTickers(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const res = (await yahooFinance.search(query, {
      quotesCount: limit,
      newsCount: 0,
      enableFuzzyQuery: true,
    })) as {
      quotes: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchDisp?: string;
        quoteType?: string;
      }>;
    };
    return (res.quotes ?? [])
      .filter((q) => q.symbol && q.quoteType === "EQUITY")
      .map((q) => ({
        symbol: q.symbol!,
        name: q.longname ?? q.shortname ?? q.symbol!,
        exchange: q.exchDisp ?? "",
        type: q.quoteType ?? "",
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Resolve user input (ticker OR company name) into a canonical ticker symbol. */
export async function resolveTicker(input: string): Promise<{
  symbol: string;
  name?: string;
  exchange?: string;
} | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Looks like a ticker (1-6 chars, mostly letters/dot/dash): try direct quote first.
  if (/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    try {
      const q = (await yahooFinance.quote(upper)) as {
        symbol?: string;
        shortName?: string;
        longName?: string;
        fullExchangeName?: string;
      } | null;
      if (q?.symbol) {
        return { symbol: q.symbol, name: q.longName ?? q.shortName, exchange: q.fullExchangeName };
      }
    } catch {
      // fall through to search
    }
  }

  const results = await searchTickers(trimmed, 1);
  if (results.length === 0) return null;
  return { symbol: results[0].symbol, name: results[0].name, exchange: results[0].exchange };
}

export type StockSnapshot = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  previousClose: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  volume: number | null;
  avgVolume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekChange: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  targetMeanPrice: number | null;
  recommendation: string | null;
  profitMargin: number | null;
  revenue: number | null;
  sector: string | null;
  industry: string | null;
};

export async function fetchSnapshot(symbol: string): Promise<StockSnapshot | null> {
  try {
    const qs = (await yahooFinance.quoteSummary(symbol, {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "summaryProfile",
      ],
    })) as Record<string, Record<string, unknown>>;

    const price = (qs.price ?? {}) as Record<string, unknown>;
    const sd = (qs.summaryDetail ?? {}) as Record<string, unknown>;
    const ks = (qs.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const fd = (qs.financialData ?? {}) as Record<string, unknown>;
    const sp = (qs.summaryProfile ?? {}) as Record<string, unknown>;

    const num = (v: unknown): number | null =>
      typeof v === "number" && !Number.isNaN(v) ? v : null;
    const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : null);

    const reg = num(price.regularMarketPrice);
    if (reg === null) return null;
    const prev = num(price.regularMarketPreviousClose);
    const dayChange = prev !== null ? reg - prev : null;
    const dayChangePct = prev !== null && prev !== 0 ? ((reg - prev) / prev) * 100 : null;

    return {
      symbol: str(price.symbol) ?? symbol,
      name: str(price.longName) ?? str(price.shortName) ?? symbol,
      exchange: str(price.exchangeName) ?? "",
      currency: str(price.currency) ?? "USD",
      price: reg,
      previousClose: prev,
      dayChange,
      dayChangePct,
      marketCap: num(price.marketCap),
      trailingPE: num(sd.trailingPE),
      forwardPE: num(sd.forwardPE),
      pegRatio: num(ks.pegRatio),
      dividendYield: num(sd.dividendYield),
      beta: num(sd.beta),
      volume: num(sd.volume),
      avgVolume: num(sd.averageVolume),
      fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),
      fiftyTwoWeekChange: num(ks["52WeekChange"]),
      trailingEps: num(ks.trailingEps),
      forwardEps: num(ks.forwardEps),
      targetMeanPrice: num(fd.targetMeanPrice),
      recommendation: str(fd.recommendationKey),
      profitMargin: num(fd.profitMargins),
      revenue: num(fd.totalRevenue),
      sector: str(sp.sector),
      industry: str(sp.industry),
    };
  } catch {
    return null;
  }
}
