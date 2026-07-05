"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { LeagueName } from "@/domain/types";
import { EVENT_DECORATIVE_ASSETS, getEventBrandAsset, getLeagueBrandAsset, SITE_DECORATIVE_ASSET, type BrandUsage } from "@/domain/brand-assets";

function ResilientBrandImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // The user-managed files are optional at build time, so a plain image permits a runtime error fallback.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" decoding="async" />;
}

const fullImageUsages: readonly BrandUsage[] = ["hero", "panel", "watermark", "header"];
const batchImageUsages: readonly BrandUsage[] = ["crest", "compact", "micro", "compact-badge"];

export function LeagueBrandMark({ league, usage = "compact", className = "" }: { league: LeagueName; usage?: BrandUsage; className?: string }) {
  const asset = getLeagueBrandAsset(league);
  const usesFullImage = fullImageUsages.includes(usage);
  const usesBatchImage = batchImageUsages.includes(usage);
  const style = { "--brand-primary": asset.primaryColor, "--brand-accent": asset.accentColor } as CSSProperties;
  return <span className={`league-brand-mark brand-${usage} league-${asset.id} ${className}`} style={style} data-brand-fallback={asset.fallbackCrest} data-brand-art={usesFullImage ? "full" : "monogram"}>
    {usesFullImage && <ResilientBrandImage src={asset.decorativeAssetPath} alt={`${league} custom league logo`} className="brand-image" />}
    {usesBatchImage && <ResilientBrandImage src={asset.batchAssetPath} alt={`${league} compact badge`} className="brand-image brand-batch-image" />}
    <span className="brand-fallback" aria-hidden>{asset.fallbackCrest}</span>
  </span>;
}

export function LeagueDecorativeArt({ league, className = "" }: { league: LeagueName; className?: string }) {
  const asset = getLeagueBrandAsset(league);
  return <span className={`league-decorative-art league-${asset.id} ${className}`} aria-hidden="true">
    <ResilientBrandImage src={asset.decorativeAssetPath} alt="" className="decorative-image" />
  </span>;
}

export function SiteDecorativeArt({ className = "" }: { className?: string }) {
  return <span className={`site-decorative-art ${className}`} aria-hidden="true">
    <ResilientBrandImage src={SITE_DECORATIVE_ASSET} alt="" className="decorative-image" />
  </span>;
}

export function LeagueWatermark({ league }: { league: LeagueName }) {
  return <LeagueBrandMark league={league} usage="watermark" className="league-watermark" />;
}

export function LeagueIdentityHeader({ league, eyebrow, children }: { league: LeagueName; eyebrow: string; children?: ReactNode }) {
  const asset = getLeagueBrandAsset(league);
  return <header className={`league-identity-header league-${asset.id}`}>
    <LeagueBrandMark league={league} usage="header" />
    <div><p>{eyebrow}</p><h2>{league}</h2>{children}</div>
  </header>;
}

export function EventBrandPanel({ night, children }: { night: "Night One" | "Night Two"; children?: ReactNode }) {
  const asset = getEventBrandAsset(night);
  return <div className="event-brand-panel">
    <span className="event-decorative-art" aria-hidden="true"><ResilientBrandImage src={EVENT_DECORATIVE_ASSETS[night]} alt="" className="decorative-image" /></span>
    <span className="event-brand-art">
      <ResilientBrandImage src={EVENT_DECORATIVE_ASSETS[night]} alt={`${asset.name} custom event logo`} className="brand-image" />
      <span className="brand-fallback" aria-hidden>{asset.fallbackCrest}</span>
    </span>
    <div><p>League Finals · Week 24</p><h2>{night}</h2>{children}</div>
  </div>;
}

export function InteractivePanel({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={`interactive-panel ${className}`}>{children}</a>;
}
