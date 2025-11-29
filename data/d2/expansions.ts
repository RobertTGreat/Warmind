/**
 * Destiny 2 Expansion Release Dates
 * Used for generating Wrapped reports per expansion period
 */

export interface Expansion {
  id: string;
  name: string;
  shortName: string;
  releaseDate: string; // ISO format YYYY-MM-DD
  endDate: string; // When the next expansion launched (or current date if ongoing)
  image: string; // Bungie.net path
  color: string; // Theme color for the wrapped report
  tagline: string;
  icon?: string;
}

// Hardcoded expansion release dates
export const EXPANSIONS: Expansion[] = [
  {
    id: 'red-war',
    name: 'Destiny 2',
    shortName: 'Red War',
    releaseDate: '2017-09-06',
    endDate: '2017-12-05',
    image: '/expansions/red-war.jpg',
    color: '#FF6B35',
    tagline: 'Our darkest hour',
  },
  {
    id: 'curse-of-osiris',
    name: 'Curse of Osiris',
    shortName: 'Curse of Osiris',
    releaseDate: '2017-12-05',
    endDate: '2018-05-08',
    image: '/expansions/curse-of-osiris.jpg',
    color: '#FFB347',
    tagline: 'Mercury awaits',
  },
  {
    id: 'warmind',
    name: 'Warmind',
    shortName: 'Warmind',
    releaseDate: '2018-05-08',
    endDate: '2018-09-04',
    image: '/expansions/warmind.webp',
    color: '#FF4444',
    tagline: 'Rasputin awakens',
  },
  {
    id: 'forsaken',
    name: 'Forsaken',
    shortName: 'Forsaken',
    releaseDate: '2018-09-04',
    endDate: '2019-06-04',
    image: '/expansions/forsaken.jpg',
    color: '#7C4DFF',
    tagline: 'For Cayde',
  },
  {
    id: 'shadowkeep',
    name: 'Shadowkeep',
    shortName: 'Shadowkeep',
    releaseDate: '2019-10-01',
    endDate: '2020-11-10',
    image: '/expansions/shadowkeep.webp',
    color: '#B71C1C',
    tagline: 'The Nightmares return',
  },
  {
    id: 'beyond-light',
    name: 'Beyond Light',
    shortName: 'Beyond Light',
    releaseDate: '2020-11-10',
    endDate: '2022-02-22',
    image: '/expansions/beyond-light.jpg',
    color: '#00BCD4',
    tagline: 'Embrace the Darkness',
  },
  {
    id: 'witch-queen',
    name: 'The Witch Queen',
    shortName: 'Witch Queen',
    releaseDate: '2022-02-22',
    endDate: '2023-02-28',
    image: '/expansions/the-witch-queen.jpg',
    color: '#4CAF50',
    tagline: 'Truth is a funny thing',
  },
  {
    id: 'lightfall',
    name: 'Lightfall',
    shortName: 'Lightfall',
    releaseDate: '2023-02-28',
    endDate: '2024-06-04',
    image: '/expansions/lightfall.jpg',
    color: '#E040FB',
    tagline: 'Stand together',
  },
  {
    id: 'final-shape',
    name: 'The Final Shape',
    shortName: 'Final Shape',
    releaseDate: '2024-06-04',
    endDate: '2025-07-15',
    image: '/expansions/the-final-shappe.jpeg',
    color: '#e3ce62',
    tagline: 'Become legend',
  },
  {
    id: 'the-edge-of-fate',
    name: 'The Edge of Fate',
    shortName: 'Edge of Fate',
    releaseDate: '2025-07-15',
    endDate: '2025-12-02',
    image: '/expansions/the-edge-of-fate.jpg',
    color: '#82eafa',
    tagline: 'Control your own destiny or someone else will',
  },
  {
    id: 'renegades',
    name: 'Renegades',
    shortName: 'Renegades',
    releaseDate: '2025-12-02',
    endDate: '2026-12-31',
    image: '/Renegades-Background.jpg',
    color: '#fef9c2',
    tagline: 'Rule the Frontier',
  },
];

/**
 * Get expansion by ID
 */
export function getExpansionById(id: string): Expansion | undefined {
  return EXPANSIONS.find(exp => exp.id === id);
}

/**
 * Get the current active expansion based on today's date
 */
export function getCurrentExpansion(): Expansion {
  const now = new Date();
  return EXPANSIONS.find(exp => {
    const start = new Date(exp.releaseDate);
    const end = new Date(exp.endDate);
    return now >= start && now <= end;
  }) || EXPANSIONS[EXPANSIONS.length - 1];
}

/**
 * Get all expansions the user could have played during
 * (based on account creation date if available, otherwise all)
 */
export function getAvailableExpansions(accountCreatedDate?: string): Expansion[] {
  if (!accountCreatedDate) return EXPANSIONS;
  
  const created = new Date(accountCreatedDate);
  return EXPANSIONS.filter(exp => {
    const endDate = new Date(exp.endDate);
    return endDate >= created;
  });
}

/**
 * Get expansion that was active on a specific date
 */
export function getExpansionForDate(date: Date): Expansion | undefined {
  return EXPANSIONS.find(exp => {
    const start = new Date(exp.releaseDate);
    const end = new Date(exp.endDate);
    return date >= start && date <= end;
  });
}

/**
 * Check if a date falls within an expansion's period
 */
export function isDateInExpansion(date: Date, expansion: Expansion): boolean {
  const start = new Date(expansion.releaseDate);
  const end = new Date(expansion.endDate);
  return date >= start && date <= end;
}

