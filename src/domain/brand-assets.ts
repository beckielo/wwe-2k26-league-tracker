import type { LeagueName } from "./types";

export type BrandUsage = "primary" | "secondary" | "ambient";

export interface LeagueBrandAsset {
  id: string;
  name: LeagueName;
  assetPath: string;
  primaryColor: string;
  accentColor: string;
  shortLabel: string;
  fallbackCrest: string;
  usageVariants: readonly BrandUsage[];
}

export interface EventBrandAsset {
  id: "league-finals-night-one" | "league-finals-night-two";
  name: "League Finals Night One" | "League Finals Night Two";
  assetPath: string;
  shortLabel: string;
  fallbackCrest: string;
  usageVariants: readonly BrandUsage[];
}

export const LEAGUE_BRAND_ASSETS: Record<LeagueName, LeagueBrandAsset> = {
  "Global League": {
    id: "global",
    name: "Global League",
    assetPath: "/brand-assets/leagues/global-league.jpg",
    primaryColor: "#dfb84d",
    accentColor: "#8f1f2d",
    shortLabel: "Global",
    fallbackCrest: "GL",
    usageVariants: ["primary", "secondary", "ambient"],
  },
  "Continental League": {
    id: "continental",
    name: "Continental League",
    assetPath: "/brand-assets/leagues/continental-league.jpg",
    primaryColor: "#83b9dc",
    accentColor: "#365f88",
    shortLabel: "Continental",
    fallbackCrest: "CL",
    usageVariants: ["primary", "secondary", "ambient"],
  },
  "National League": {
    id: "national",
    name: "National League",
    assetPath: "/brand-assets/leagues/national-league.jpg",
    primaryColor: "#d97946",
    accentColor: "#9e3028",
    shortLabel: "National",
    fallbackCrest: "NL",
    usageVariants: ["primary", "secondary", "ambient"],
  },
  "Regional League": {
    id: "regional",
    name: "Regional League",
    assetPath: "/brand-assets/leagues/regional-league.jpg",
    primaryColor: "#5fae79",
    accentColor: "#3e5960",
    shortLabel: "Regional",
    fallbackCrest: "RL",
    usageVariants: ["primary", "secondary", "ambient"],
  },
};

export const EVENT_BRAND_ASSETS: Record<EventBrandAsset["id"], EventBrandAsset> = {
  "league-finals-night-one": {
    id: "league-finals-night-one",
    name: "League Finals Night One",
    assetPath: "/brand-assets/events/league-finals-night-one.jpg",
    shortLabel: "Night One",
    fallbackCrest: "N1",
    usageVariants: ["primary", "secondary", "ambient"],
  },
  "league-finals-night-two": {
    id: "league-finals-night-two",
    name: "League Finals Night Two",
    assetPath: "/brand-assets/events/league-finals-night-two.jpg",
    shortLabel: "Night Two",
    fallbackCrest: "N2",
    usageVariants: ["primary", "secondary", "ambient"],
  },
};

export const DECORATIVE_ASSET_DIRECTORY = "/brand-assets/decorative/";

export function getLeagueBrandAsset(league: LeagueName): LeagueBrandAsset {
  return LEAGUE_BRAND_ASSETS[league];
}

export function getEventBrandAsset(night: "Night One" | "Night Two"): EventBrandAsset {
  return EVENT_BRAND_ASSETS[night === "Night One" ? "league-finals-night-one" : "league-finals-night-two"];
}
