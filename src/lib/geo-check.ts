// Composite GEO score from site analysis (skill results only)

export interface CompositeGeoScore {
  total: number; // 0-100
  citability: number; // 0-100, weight 40%
  contentQuality: number; // 0-100, weight 25%
  crawlerAccess: number; // 0-100, weight 20%
  schema: number; // 0-100, weight 15%
}

export function calculateCompositeScore(components: {
  citability: number;
  contentQuality: number;
  crawlerAccess: number;
  schema: number;
}): CompositeGeoScore {
  const total = Math.round(
    components.citability * 0.40 +
    components.contentQuality * 0.25 +
    components.crawlerAccess * 0.20 +
    components.schema * 0.15
  );

  return {
    total,
    ...components,
  };
}
