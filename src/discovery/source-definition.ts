import type { ExperienceCategory } from '../domain/categories.js';

export interface HtmlSourceDefinition {
  id: string;
  name: string;
  category: ExperienceCategory;
  url: string;
  region: string;
  city?: string;
  venue?: string;
  itemSelector?: string;
  linkSelector?: string;
  descriptionSelector?: string;
  maxItems?: number;
  tags?: string[];
}
