import { WILSONART_CATALOG, searchWilsonart } from './wilsonartCatalog.js';
import { FORMICA_CATALOG, searchFormica } from './formicaCatalog.js';

export { WILSONART_CATALOG, searchWilsonart } from './wilsonartCatalog.js';
export { FORMICA_CATALOG, searchFormica } from './formicaCatalog.js';

/**
 * Unified laminate search across Wilsonart and Formica standards.
 * Returns segmented results for each brand and a flattened list for keyboard navigation.
 *
 * @param {string} query
 * @param {number} limitPerBrand
 * @returns {{
 *   wilsonart: Array<{brand: string, name: string, number: string, label: string}>,
 *   formica: Array<{brand: string, name: string, number: string, label: string}>,
 *   all: Array<{brand: string, name: string, number: string, label: string, globalIndex: number}>,
 *   totalMatches: number
 * }}
 */
export function searchLaminates(query, limitPerBrand = 8) {
  if (!query || typeof query !== 'string') {
    return { wilsonart: [], formica: [], all: [], totalMatches: 0 };
  }

  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return { wilsonart: [], formica: [], all: [], totalMatches: 0 };
  }

  // Brand-targeted queries
  const isWilsonartOnly = q.startsWith('wilsonart');
  const isFormicaOnly = q.startsWith('formica');

  const wilsonartMatches = isFormicaOnly ? [] : searchWilsonart(query, limitPerBrand).map((item) => ({
    ...item,
    brand: 'Wilsonart',
  }));

  const formicaMatches = isWilsonartOnly ? [] : searchFormica(query, limitPerBrand).map((item) => ({
    ...item,
    brand: 'Formica',
  }));

  // Assign linear globalIndex to both segmented items and the unified all list
  let indexCounter = 0;

  const wilsonartWithIndex = wilsonartMatches.map((item) => ({
    ...item,
    globalIndex: indexCounter++,
  }));

  const formicaWithIndex = formicaMatches.map((item) => ({
    ...item,
    globalIndex: indexCounter++,
  }));

  const all = [...wilsonartWithIndex, ...formicaWithIndex];

  return {
    wilsonart: wilsonartWithIndex,
    formica: formicaWithIndex,
    all,
    totalMatches: all.length,
  };
}
