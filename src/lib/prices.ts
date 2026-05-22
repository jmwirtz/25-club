import YahooFinance from "yahoo-finance2";
import type { Quote } from "./types";

const yahooFinance = new YahooFinance();

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
