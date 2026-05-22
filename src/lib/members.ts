import type { Member } from "./types";

// Member roster derived from the May 2026 holdings report. The "background"
// fields are placeholders — fill them in (profession, hobbies, sector interests,
// quirks) so the AI analyzer can surface meaningful conversation hooks for each
// person at meetings.
export const MEMBERS: Member[] = [
  { lastName: "Brake",      background: "" },
  { lastName: "Buckley",    background: "" },
  { lastName: "Caldwell",   background: "" },
  { lastName: "Champoux",   background: "" },
  { lastName: "Clare",      background: "" },
  { lastName: "Clay",       background: "" },
  { lastName: "Dunlap",     background: "" },
  { lastName: "Fordham",    background: "" },
  { lastName: "Goins",      background: "" },
  { lastName: "Gronewold",  background: "" },
  { lastName: "Henning",    background: "" },
  { lastName: "Hesser",     background: "" },
  { lastName: "Hove",       background: "" },
  { lastName: "C. Hove",    background: "" },
  { lastName: "Lester",     background: "" },
  { lastName: "Maly",       background: "" },
  { lastName: "Meginnis",   background: "" },
  { lastName: "Otte",       background: "" },
  { lastName: "R. Scott",   background: "" },
  { lastName: "Smith",      background: "" },
  { lastName: "C. Smith",   background: "" },
  { lastName: "Stuckey",    background: "" },
  { lastName: "Whitehead",  background: "" },
  { lastName: "Wirtz",      background: "John Wirtz — building this app." },
];

// Note: the May 2026 report says 25 total members but only 24 distinct
// last names appear in the holdings table. One member may not be the point
// person on any position right now — add them here once known.

