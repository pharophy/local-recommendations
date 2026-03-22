export const EXPERIENCE_CATEGORIES = [
  'Activities',
  'Restaurants',
  'Nature',
  'SpecialEvents',
] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];

export const DEFAULT_REGION_PRIORITY = [
  'Orange County',
  'Los Angeles',
  'Temecula',
  'San Diego',
] as const;

export type RegionName = string;

export function isExperienceCategory(value: string): value is ExperienceCategory {
  return EXPERIENCE_CATEGORIES.includes(value as ExperienceCategory);
}
