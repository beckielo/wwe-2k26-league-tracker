import type { LeagueName } from "./types";

export type BrandUsage =
  | "hero"
  | "panel"
  | "watermark"
  | "header"
  | "crest"
  | "compact"
  | "micro"
  | "background-accent"
  | "decorative-accent"
  | "match-preview-art"
  | "compact-badge";

export interface LeagueBrandAsset {
  id: string;
  name: LeagueName;
  assetPath: string;
  batchAssetPath: string;
  decorativeAssetPath: string;
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
    batchAssetPath: "/brand-assets/decorative/batches/deco-gl-batch.png",
    decorativeAssetPath: "/brand-assets/decorative/leagues/deco-gl.png",
    primaryColor: "#dfb84d",
    accentColor: "#8f1f2d",
    shortLabel: "Global",
    fallbackCrest: "GL",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro", "background-accent", "decorative-accent", "match-preview-art", "compact-badge"],
  },
  "Continental League": {
    id: "continental",
    name: "Continental League",
    assetPath: "/brand-assets/leagues/continental-league.jpg",
    batchAssetPath: "/brand-assets/decorative/batches/deco-cl-batch.png",
    decorativeAssetPath: "/brand-assets/decorative/leagues/deco-cl.png",
    primaryColor: "#83b9dc",
    accentColor: "#365f88",
    shortLabel: "Continental",
    fallbackCrest: "CL",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro", "background-accent", "decorative-accent", "match-preview-art", "compact-badge"],
  },
  "National League": {
    id: "national",
    name: "National League",
    assetPath: "/brand-assets/leagues/national-league.jpg",
    batchAssetPath: "/brand-assets/decorative/batches/deco-nl-batch.png",
    decorativeAssetPath: "/brand-assets/decorative/leagues/deco-nl.png",
    primaryColor: "#d97946",
    accentColor: "#9e3028",
    shortLabel: "National",
    fallbackCrest: "NL",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro", "background-accent", "decorative-accent", "match-preview-art", "compact-badge"],
  },
  "Regional League": {
    id: "regional",
    name: "Regional League",
    assetPath: "/brand-assets/leagues/regional-league.jpg",
    batchAssetPath: "/brand-assets/decorative/batches/deco-rl-batch.png",
    decorativeAssetPath: "/brand-assets/decorative/leagues/deco-rl.png",
    primaryColor: "#5fae79",
    accentColor: "#3e5960",
    shortLabel: "Regional",
    fallbackCrest: "RL",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro", "background-accent", "decorative-accent", "match-preview-art", "compact-badge"],
  },
};

export const EVENT_BRAND_ASSETS: Record<EventBrandAsset["id"], EventBrandAsset> = {
  "league-finals-night-one": {
    id: "league-finals-night-one",
    name: "League Finals Night One",
    assetPath: "/brand-assets/events/league-finals-night-one.jpg",
    shortLabel: "Night One",
    fallbackCrest: "N1",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro"],
  },
  "league-finals-night-two": {
    id: "league-finals-night-two",
    name: "League Finals Night Two",
    assetPath: "/brand-assets/events/league-finals-night-two.jpg",
    shortLabel: "Night Two",
    fallbackCrest: "N2",
    usageVariants: ["hero", "panel", "watermark", "header", "crest", "compact", "micro"],
  },
};

export const DECORATIVE_ASSET_DIRECTORY = "/brand-assets/decorative/";
export const SITE_DECORATIVE_ASSET = `${DECORATIVE_ASSET_DIRECTORY}site/deco-gwf-logo.png`;
export const EVENT_DECORATIVE_ASSETS = {
  "Night One": `${DECORATIVE_ASSET_DIRECTORY}events/deco-finals-n1.png`,
  "Night Two": `${DECORATIVE_ASSET_DIRECTORY}events/deco-finals-n2.png`,
} as const;

export function getLeagueBrandAsset(league: LeagueName): LeagueBrandAsset {
  return LEAGUE_BRAND_ASSETS[league];
}

export function getEventBrandAsset(night: "Night One" | "Night Two"): EventBrandAsset {
  return EVENT_BRAND_ASSETS[night === "Night One" ? "league-finals-night-one" : "league-finals-night-two"];
}
