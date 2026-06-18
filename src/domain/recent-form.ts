import type { HistoricalMatchResult, HistoricalResultType } from "./match-history";

export const FORM_EMOJI: Record<HistoricalResultType, string> = { win: "🟩", draw: "⬜", loss: "🟥" };

export interface RecentFormOutcome {
  matchId: string;
  week: number;
  split: string;
  year: number;
  outcome: HistoricalResultType;
  emoji: string;
}

export interface RecentFormContext {
  wrestler: string;
  lastOutcomes: RecentFormOutcome[];
  dataQualityWarnings: string[];
}

export function outcomeForWrestler(match: HistoricalMatchResult, wrestler: string): HistoricalResultType | null {
  if (match.wrestlerA !== wrestler && match.wrestlerB !== wrestler) return null;
  if (match.resultType === "Draw" || match.resultType === "No Contest") return "draw";
  return match.winner === wrestler ? "win" : "loss";
}

export function getRecentForm(wrestler: string, history: HistoricalMatchResult[], limit = 3): RecentFormContext {
  const lastOutcomes = history
    .filter((match) => match.wrestlerA === wrestler || match.wrestlerB === wrestler)
    .slice(-limit)
    .map((match) => {
      const outcome = outcomeForWrestler(match, wrestler) ?? "draw";
      return { matchId: match.matchId, week: match.week, split: match.split, year: match.leagueYear, outcome, emoji: FORM_EMOJI[outcome] };
    });
  return { wrestler, lastOutcomes, dataQualityWarnings: lastOutcomes.length === 0 ? [`No recorded recent form for ${wrestler}.`] : [] };
}
