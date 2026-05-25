/* eslint-disable */
// Parses every PDF in 25_Club_Reports/ into a normalized monthly snapshot
// dataset. Output: src/lib/snapshots.generated.ts
//
// Run: node scripts/parse-reports.js

const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const REPORTS_DIR = path.join(__dirname, "..", "25_Club_Reports");
const OUT_FILE = path.join(__dirname, "..", "src", "lib", "snapshots.generated.ts");

const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

const ASSET_CLASSES = [
  "Large US Gro Eq", "Large US Val Eq", "Large US Bl Eq",
  "Mid Cap US Gro Eq", "Mid Cap US Val Eq", "Mid Cap US Bl Eq",
  "Small US Gro Eq", "Small US Val Eq", "Small US Bl Eq",
  "Large For Eq", "Small For Eq",
  "Sector", "Commodity",
  "Cash and Equiv", "Clash and Equiv", "Cash and Equivalents",
];

// Manual name → ticker mapping covering current + historical holdings.
const NAME_TO_TICKER = {
  "Advanced Micro Devices Inc": "AMD",
  "Aecom": "ACM",
  "Alphabet Inc Cl C": "GOOG",
  "Amazon.com Inc": "AMZN",
  "Amgen Inc": "AMGN",
  "Amphenol Corp Class A New": "APH",
  "Amphenol Corp Cl A": "APH",
  "Apple Inc": "AAPL",
  "Asml Holding Nv Ny Registry Shs New 2012": "ASML",
  "Berkshire Hathaway Inc Cl B": "BRK-B",
  "Blackrock Inc": "BLK",
  "Boeing Company": "BA",
  "Bristol Myers Squibb Company": "BMY",
  "Caterpillar Inc": "CAT",
  "Cincinnati Financial Corp": "CINF",
  "Corteva Inc": "CTVA",
  "Danaher Corp": "DHR",
  "Fedex Corp": "FDX",
  "Fiserv Inc": "FI",
  "Gatx Corp": "GATX",
  "General Electric Co": "GE",
  "Ge Aerospace": "GE",
  "Ge Vernova LLC": "GEV",
  "Global X Uranium Etf": "URA",
  "Intuitive Surgical Inc": "ISRG",
  "Intuitive Surgical Inc New": "ISRG",
  "Eog Resources Inc": "EOG",
  "Unitedhealth Group Inc": "UNH",
  "Ishares Silver Trust": "SLV",
  "Lowes Companies Inc": "LOW",
  "Marathon Petroleum Corp": "MPC",
  "Microsoft Corp": "MSFT",
  "Monster Beverage Corp New": "MNST",
  "Monster Beverage Corp": "MNST",
  "Moodys Corp": "MCO",
  "Nelnet Inc Cl A": "NNI",
  "Nextera Energy Inc": "NEE",
  "Nike Inc Cl B": "NKE",
  "Niocorp Developments LTD": "NB",
  "Nvidia Corp": "NVDA",
  "Palo Alto Networks Inc": "PANW",
  "Paypal Holdings Inc": "PYPL",
  "Pepsico Inc": "PEP",
  "Pfizer Inc": "PFE",
  "Phillips 66": "PSX",
  "Remitly Global Inc": "RELY",
  "Rockwell Automation Inc": "ROK",
  "Salesforce Inc": "CRM",
  "Sherwin Williams Co": "SHW",
  "Synopsys Inc": "SNPS",
  "Target Corp": "TGT",
  "Tenet Healthcare Corp New": "THC",
  "Tenet Healthcare Corp": "THC",
  "Thermo Fisher Scientific Inc": "TMO",
  "Tjx Cos Inc New": "TJX",
  "Tjx Cos Inc": "TJX",
  "Tokio Marine Holdings Inc Spon Adr": "TKOMY",
  "Uber Technologies Inc": "UBER",
  "Union Pacific Corp": "UNP",
  "Verizon Communications Inc": "VZ",
  "Vertiv Holdings LLC Cl A": "VRT",
  "Visa Inc Cl A": "V",
  "Wells Fargo & Co": "WFC",
  "Zions Bancorporation N A": "ZION",
  "Zoetis Inc Cl A": "ZTS",
};

// Cash / money market — track separately, not as equity positions.
const CASH_NAMES = new Set([
  "Insured Cash Account",
  "Jpmorgan 100% U S Treas Secs Mmkt Premier",
]);

function monthKeyFromFile(filename) {
  // e.g., "25 Club Report - April Meeting 2024.pdf"
  const m = filename.match(/-\s*(\w+)\s*Meeting\s*(\d{4})\.pdf$/i);
  if (!m) return null;
  const month = MONTHS[m[1]];
  const year = parseInt(m[2], 10);
  if (!month) return null;
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}` };
}

function parseRow(line) {
  // Detect asset class anywhere in line
  let assetClass = null;
  let acIdx = -1;
  for (const ac of ASSET_CLASSES) {
    const idx = line.indexOf(ac);
    if (idx >= 0 && (acIdx < 0 || idx < acIdx)) {
      assetClass = ac;
      acIdx = idx;
    }
  }
  if (!assetClass) return null;

  // Skip cash rows
  const namePart = line.slice(0, acIdx).replace(/\t/g, " ").trim();
  if (CASH_NAMES.has(namePart) || /^(Total|Insured Cash|Jpmorgan)/i.test(namePart)) {
    return { kind: "cash", name: namePart, assetClass, rest: line.slice(acIdx + assetClass.length).trim() };
  }

  // Skip header row
  if (/^Fund$/i.test(namePart)) return null;

  const after = line.slice(acIdx + assetClass.length);

  // Find "qty date price" — qty is integer, date is M/D/YYYY, price is decimal
  const m = after.match(/(\d{1,5}(?:\.\d+)?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([\d,]+\.\d{2})/);
  if (!m) return null;

  const quantity = parseFloat(m[1]);
  const dop = m[2];
  // price not used; we use purchase cost
  let tail = after.slice(m.index + m[0].length);

  // The tail contains:  $   pct%   purchaseCost  $   marketValue  $   gainLoss  $   member
  // Capture the percentage and STRIP it so it doesn't get mistaken for a dollar amount.
  const pctMatch = tail.match(/([\d.]+)%/);
  const pct = pctMatch ? parseFloat(pctMatch[1]) : null;
  if (pctMatch) tail = tail.replace(pctMatch[0], "");

  // Extract all decimal numbers (possibly in parens for negatives) from the remaining tail.
  const numRe = /\(?[-+]?[\d,]+\.\d{2}\)?/g;
  const nums = (tail.match(numRe) || []).map((n) => {
    const isNeg = n.startsWith("(") && n.endsWith(")");
    const cleaned = n.replace(/[(),$]/g, "");
    const v = parseFloat(cleaned);
    return isNeg ? -v : v;
  });

  if (nums.length < 3) return null;
  const [purchaseCost, marketValue, gainLoss] = nums;

  // Member is whatever comes after the final $ at the end of the line
  // Last $ position
  const lastDollar = tail.lastIndexOf("$");
  let member = null;
  if (lastDollar >= 0) {
    member = tail.slice(lastDollar + 1).replace(/\t/g, " ").trim();
    member = member || null;
  }

  // Normalize ticker
  const ticker = NAME_TO_TICKER[namePart] || null;

  return {
    kind: "holding",
    name: namePart,
    assetClass,
    ticker,
    quantity,
    dop,
    purchaseCost,
    marketValue,
    gainLoss,
    pctOfAccount: pct,
    member,
  };
}

function parseHistoricalReturns(text) {
  const returns = {};
  for (const m of text.matchAll(/^(20\d{2})\s+([-\d.]+)%\s+([-\d.]+)%\s+([-\d.]+)%\s+([-\d.NA\/*]+)%?/gm)) {
    const year = parseInt(m[1], 10);
    const clubRaw = m[5];
    const club = clubRaw === "N/A" ? null : parseFloat(clubRaw.replace(/[*]/g, ""));
    returns[year] = {
      sp500: parseFloat(m[2]),
      djia: parseFloat(m[3]),
      nasdaq100: parseFloat(m[4]),
      club,
    };
  }
  return returns;
}

function parseTotalBalance(text) {
  // "Total Account Balance (3/29/2024)  997,698.03 $"
  const m = text.match(/Total Account Balance\s*\(([\d/]+)\)\s+([\d,]+\.\d{2})/);
  if (!m) return null;
  return { asOf: m[1], total: parseFloat(m[2].replace(/,/g, "")) };
}

async function parseFile(filePath) {
  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });
  const r = await parser.getText();
  const text = r.text || "";
  const lines = text.split(/\r?\n/);
  const holdings = [];
  const cash = [];
  const unmatched = [];
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const row = parseRow(ln);
    if (row?.kind === "holding") holdings.push(row);
    else if (row?.kind === "cash") cash.push(row);
  }
  // unmatched: lines that contain a date pattern but didn't parse — for debugging
  for (const ln of lines) {
    if (!/\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(ln)) continue;
    if (/Total Account Balance|Per Member|Intraday Cash|Original DOP/.test(ln)) continue;
    if (parseRow(ln)) continue;
    unmatched.push(ln.trim());
  }
  return {
    text,
    totalBalance: parseTotalBalance(text),
    historicalReturns: parseHistoricalReturns(text),
    holdings,
    cash,
    unmatched,
  };
}

async function main() {
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".pdf")).sort();
  const snapshots = [];
  for (const f of files) {
    const key = monthKeyFromFile(f);
    if (!key) {
      console.warn("skipping (no month):", f);
      continue;
    }
    const parsed = await parseFile(path.join(REPORTS_DIR, f));
    snapshots.push({ file: f, ...key, ...parsed });
    const missingTickers = parsed.holdings.filter((h) => !h.ticker).map((h) => h.name);
    console.log(`${key.key} ${f}: ${parsed.holdings.length} holdings, missing tickers: ${missingTickers.length}, unmatched lines: ${parsed.unmatched.length}`);
    if (missingTickers.length) console.log("   missing:", [...new Set(missingTickers)]);
    if (parsed.unmatched.length) console.log("   unmatched:", parsed.unmatched.slice(0, 3));
  }
  // Sort chronologically
  snapshots.sort((a, b) => a.key.localeCompare(b.key));

  // Emit a compact dataset
  const dataset = snapshots.map((s) => ({
    monthKey: s.key,
    year: s.year,
    month: s.month,
    asOf: s.totalBalance?.asOf ?? null,
    totalBalance: s.totalBalance?.total ?? null,
    holdings: s.holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      assetClass: h.assetClass,
      quantity: h.quantity,
      dop: h.dop,
      purchaseCost: h.purchaseCost,
      marketValue: h.marketValue,
      member: h.member,
    })),
  }));

  const header = `// AUTO-GENERATED by scripts/parse-reports.js — do not edit by hand.
// Regenerate with: node scripts/parse-reports.js
//
// Snapshot of holdings extracted from each monthly LPL/Flagstone report.
// Used to derive transaction history (buys, sells, increases, decreases).

export type SnapshotHolding = {
  ticker: string | null;
  name: string;
  assetClass: string;
  quantity: number;
  dop: string;        // original date of purchase as listed in the report
  purchaseCost: number;
  marketValue: number;
  member: string | null;
};

export type MonthlySnapshot = {
  monthKey: string;   // YYYY-MM, derived from the report filename (= meeting month)
  year: number;
  month: number;
  asOf: string | null;       // report "as of" date (M/D/YYYY)
  totalBalance: number | null;
  holdings: SnapshotHolding[];
};

export const SNAPSHOTS: MonthlySnapshot[] = ${JSON.stringify(dataset, null, 2)};
`;
  fs.writeFileSync(OUT_FILE, header);
  console.log(`\nWrote ${snapshots.length} snapshots → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
