export type WrestlerPoolEntry = {
  id: string;
  name: string;
  gender: "male";
  source?: "wwe2k26" | "custom" | "project";
};

// Internal hidden seed list for Phase 15A automatic roster generation.
// Keep this list male-only and easy to replace with the verified WWE 2K26 roster when available.
export const HIDDEN_MALE_WRESTLER_POOL: WrestlerPoolEntry[] = [
  "AJ Styles", "Akira Tozawa", "Aleister Black", "Andrade", "Angel", "Angelo Dawkins", "Apollo Crews", "Austin Theory",
  "Berto", "Braun Strowman", "Bray Wyatt", "Bron Breakker", "Bronson Reed", "Brooks Jensen", "Brutus Creed", "Carmelo Hayes",
  "Chad Gable", "Cody Rhodes", "Cruz Del Toro", "Damian Priest", "Dexter Lumis", "Dominik Mysterio", "Dragon Lee", "Drew McIntyre",
  "Elton Prince", "Erik", "Finn Balor", "Giovanni Vinci", "Grayson Waller", "Gunther", "Ilja Dragunov", "Ivar",
  "JD McDonagh", "Jey Uso", "Jimmy Uso", "Joaquin Wilde", "Joe Gacy", "Johnny Gargano", "Julius Creed", "Karrion Kross",
  "Kofi Kingston", "LA Knight", "Logan Paul", "Ludwig Kaiser", "Montez Ford", "Nathan Frazer", "Otis", "Pete Dunne",
  "R-Truth", "Randy Orton", "Rey Mysterio", "Ridge Holland", "Roman Reigns", "Sami Zayn", "Santos Escobar", "Seth Rollins",
  "Sheamus", "Shinsuke Nakamura", "Solo Sikoa", "The Miz", "Tommaso Ciampa", "Trick Williams", "Uncle Howdy", "Xavier Woods",
].map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, gender: "male", source: "project" }));

export function validateWrestlerPool(pool: WrestlerPoolEntry[] = HIDDEN_MALE_WRESTLER_POOL): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const entry of pool) {
    const name = entry.name.trim().replace(/\s+/g, " ");
    const id = entry.id.trim();
    if (!id) errors.push("Hidden wrestler pool contains an empty id.");
    if (!name) errors.push("Hidden wrestler pool contains an empty name.");
    if (entry.gender !== "male") errors.push(`${name || id}: hidden wrestler pool must be male-only for Phase 15A.`);
    const idKey = id.toLocaleLowerCase();
    const nameKey = name.toLocaleLowerCase();
    if (idKey && seenIds.has(idKey)) errors.push(`${id}: duplicate hidden wrestler pool id.`);
    if (nameKey && seenNames.has(nameKey)) errors.push(`${name}: duplicate hidden wrestler pool name.`);
    if (idKey) seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
  }
  return [...new Set(errors)];
}
