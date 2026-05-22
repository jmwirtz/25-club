export type Holding = {
  ticker: string;
  name: string;
  assetClass: string;
  quantity: number;
  originalDOP: string;
  purchaseCost: number;
  member: string | null;
};

export type Member = {
  lastName: string;
  fullName?: string;
  background?: string;
};

export type Quote = {
  ticker: string;
  price: number | null;
  currency?: string;
  previousClose?: number | null;
  error?: string;
};

export type EnrichedHolding = Holding & {
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
};
