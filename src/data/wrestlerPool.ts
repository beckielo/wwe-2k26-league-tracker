export type WrestlerPoolEntry = {
  id: string;
  name: string;
  gender: "male";
  source: "wwe2k26" | "project";
};

const hiddenMaleWrestlerPoolEntries = [
  // Project-known current roster names from the source workbook Roster_Seeds / Standings_Current sheets.
  { id: "gunther", name: "Gunther", gender: "male", source: "project" },
  { id: "roman-reigns", name: "Roman Reigns", gender: "male", source: "project" },
  { id: "cody-rhodes", name: "Cody Rhodes", gender: "male", source: "project" },
  { id: "brock-lesnar", name: "Brock Lesnar", gender: "male", source: "project" },
  { id: "kurt-angle", name: "Kurt Angle", gender: "male", source: "project" },
  { id: "seth-rollins", name: "Seth Rollins", gender: "male", source: "project" },
  { id: "cm-punk", name: "CM Punk", gender: "male", source: "project" },
  { id: "bron-breakker", name: "Bron Breakker", gender: "male", source: "project" },
  { id: "john-cena", name: "John Cena", gender: "male", source: "project" },
  { id: "aj-styles", name: "AJ Styles", gender: "male", source: "project" },
  { id: "undertaker", name: "Undertaker", gender: "male", source: "project" },
  { id: "triple-h", name: "Triple H", gender: "male", source: "project" },
  { id: "drew-mcintyre", name: "Drew McIntyre", gender: "male", source: "project" },
  { id: "randy-orton", name: "Randy Orton", gender: "male", source: "project" },
  { id: "jacob-fatu", name: "Jacob Fatu", gender: "male", source: "project" },
  { id: "finn-balor", name: "Finn Bálor", gender: "male", source: "project" },
  { id: "sheamus", name: "Sheamus", gender: "male", source: "project" },
  { id: "ilja-dragunov", name: "Ilja Dragunov", gender: "male", source: "project" },
  { id: "shawn-michaels", name: "Shawn Michaels", gender: "male", source: "project" },
  { id: "bronson-reed", name: "Bronson Reed", gender: "male", source: "project" },
  { id: "damian-priest", name: "Damian Priest", gender: "male", source: "project" },
  { id: "solo-sikoa", name: "Solo Sikoa", gender: "male", source: "project" },
  { id: "kevin-owens", name: "Kevin Owens", gender: "male", source: "project" },
  { id: "the-rock", name: "The Rock", gender: "male", source: "project" },
  { id: "shinsuke-nakamura", name: "Shinsuke Nakamura", gender: "male", source: "project" },
  { id: "penta", name: "Penta", gender: "male", source: "project" },
  { id: "trick-williams", name: "Trick Williams", gender: "male", source: "project" },
  { id: "carmelo-hayes", name: "Carmelo Hayes", gender: "male", source: "project" },
  { id: "austin-theory", name: "Austin Theory", gender: "male", source: "project" },
  { id: "dominik-mysterio", name: "Dominik Mysterio", gender: "male", source: "project" },
  { id: "rey-mysterio", name: "Rey Mysterio", gender: "male", source: "project" },
  { id: "beckielo", name: "Beckielo", gender: "male", source: "project" },
  { id: "ethan-page", name: "Ethan Page", gender: "male", source: "project" },
  { id: "sami-zayn", name: "Sami Zayn", gender: "male", source: "project" },
  { id: "la-knight", name: "LA Knight", gender: "male", source: "project" },
  { id: "jey-uso", name: "Jey Uso", gender: "male", source: "project" },
  { id: "dragon-lee", name: "Dragon Lee", gender: "male", source: "project" },
  { id: "the-miz", name: "The Miz", gender: "male", source: "project" },
  { id: "big-e", name: "Big E", gender: "male", source: "project" },
  { id: "xavier-woods", name: "Xavier Woods", gender: "male", source: "project" },
  { id: "montez-ford", name: "Montez Ford", gender: "male", source: "project" },
  { id: "kofi-kingston", name: "Kofi Kingston", gender: "male", source: "project" },
  { id: "johnny-gargano", name: "Johnny Gargano", gender: "male", source: "project" },
  { id: "pete-dunne", name: "Pete Dunne", gender: "male", source: "project" },
  { id: "chad-gable", name: "Chad Gable", gender: "male", source: "project" },
  { id: "grayson-waller", name: "Grayson Waller", gender: "male", source: "project" },
  { id: "angelo-dawkins", name: "Angelo Dawkins", gender: "male", source: "project" },
  { id: "axiom", name: "Axiom", gender: "male", source: "project" },

  // Project-known names carried forward from the Phase 15A hidden pool.
  // TODO: Complete male WWE 2K26 roster list should be verified before final expansion.
  { id: "akira-tozawa", name: "Akira Tozawa", gender: "male", source: "project" },
  { id: "aleister-black", name: "Aleister Black", gender: "male", source: "project" },
  { id: "andrade", name: "Andrade", gender: "male", source: "project" },
  { id: "angel", name: "Angel", gender: "male", source: "project" },
  { id: "apollo-crews", name: "Apollo Crews", gender: "male", source: "project" },
  { id: "berto", name: "Berto", gender: "male", source: "project" },
  { id: "braun-strowman", name: "Braun Strowman", gender: "male", source: "project" },
  { id: "bray-wyatt", name: "Bray Wyatt", gender: "male", source: "project" },
  { id: "brooks-jensen", name: "Brooks Jensen", gender: "male", source: "project" },
  { id: "brutus-creed", name: "Brutus Creed", gender: "male", source: "project" },
  { id: "cruz-del-toro", name: "Cruz Del Toro", gender: "male", source: "project" },
  { id: "dexter-lumis", name: "Dexter Lumis", gender: "male", source: "project" },
  { id: "elton-prince", name: "Elton Prince", gender: "male", source: "project" },
  { id: "erik", name: "Erik", gender: "male", source: "project" },
  { id: "giovanni-vinci", name: "Giovanni Vinci", gender: "male", source: "project" },
  { id: "ivar", name: "Ivar", gender: "male", source: "project" },
  { id: "jd-mcdonagh", name: "JD McDonagh", gender: "male", source: "project" },
  { id: "jimmy-uso", name: "Jimmy Uso", gender: "male", source: "project" },
  { id: "joaquin-wilde", name: "Joaquin Wilde", gender: "male", source: "project" },
  { id: "joe-gacy", name: "Joe Gacy", gender: "male", source: "project" },
  { id: "julius-creed", name: "Julius Creed", gender: "male", source: "project" },
  { id: "karrion-kross", name: "Karrion Kross", gender: "male", source: "project" },
  { id: "logan-paul", name: "Logan Paul", gender: "male", source: "project" },
  { id: "ludwig-kaiser", name: "Ludwig Kaiser", gender: "male", source: "project" },
  { id: "nathan-frazer", name: "Nathan Frazer", gender: "male", source: "project" },
  { id: "otis", name: "Otis", gender: "male", source: "project" },
  { id: "r-truth", name: "R-Truth", gender: "male", source: "project" },
  { id: "ridge-holland", name: "Ridge Holland", gender: "male", source: "project" },
  { id: "santos-escobar", name: "Santos Escobar", gender: "male", source: "project" },
  { id: "tommaso-ciampa", name: "Tommaso Ciampa", gender: "male", source: "project" },
  { id: "uncle-howdy", name: "Uncle Howdy", gender: "male", source: "project" },
] satisfies WrestlerPoolEntry[];

export const HIDDEN_MALE_WRESTLER_POOL: WrestlerPoolEntry[] = hiddenMaleWrestlerPoolEntries;

export function getMaleWrestlerPool(pool: WrestlerPoolEntry[] = HIDDEN_MALE_WRESTLER_POOL): WrestlerPoolEntry[] {
  return pool.filter((entry) => entry.gender === "male");
}

export function getMaleWrestlerPoolCount(pool: WrestlerPoolEntry[] = HIDDEN_MALE_WRESTLER_POOL): number {
  return getMaleWrestlerPool(pool).length;
}

export function validateWrestlerPool(pool: WrestlerPoolEntry[] = HIDDEN_MALE_WRESTLER_POOL): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const entry of pool) {
    const name = entry.name.trim().replace(/\s+/g, " ");
    const id = entry.id.trim();
    if (!id) errors.push("Hidden wrestler pool contains an empty id.");
    if (id !== entry.id) errors.push(`${entry.name || "Hidden wrestler"}: hidden wrestler pool id must be trimmed.`);
    if (!name) errors.push("Hidden wrestler pool contains an empty name.");
    if (name !== entry.name) errors.push(`${entry.name || id}: hidden wrestler pool name must be trimmed.`);
    if (entry.gender !== "male") errors.push(`${name || id}: hidden wrestler pool must be male-only for Phase 16.`);
    if (entry.source !== "wwe2k26" && entry.source !== "project") errors.push(`${name || id}: hidden wrestler pool has an invalid source.`);
    const idKey = id.toLocaleLowerCase();
    const nameKey = name.toLocaleLowerCase();
    if (idKey && seenIds.has(idKey)) errors.push(`${id}: duplicate hidden wrestler pool id.`);
    if (nameKey && seenNames.has(nameKey)) errors.push(`${name}: duplicate hidden wrestler pool name.`);
    if (idKey) seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
  }
  return [...new Set(errors)];
}
