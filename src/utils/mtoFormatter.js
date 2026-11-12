/**
 * MTO Formatter & Breakdown Engine
 * Formats line items according to standard shop take-off rules and historical document layouts.
 */

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Parse thickness in inches from string or material folder name
 * (e.g. "1 1-8" -> 1.125, "3-4" -> 0.75, "15-16" -> 0.9375, "1/2" -> 0.5)
 */
export function parseThicknessFromName(name) {
  if (!name) return 0.75;
  const cleanName = String(name).trim();

  const matchWholeFrac = cleanName.match(/^(\d+)[\s-]+(\d+)[-/](\d+)(?![a-zA-Z])/);
  if (matchWholeFrac) {
    const whole = parseFloat(matchWholeFrac[1]);
    const num = parseFloat(matchWholeFrac[2]);
    const den = parseFloat(matchWholeFrac[3]);
    if (den !== 0) return parseFloat((whole + num / den).toFixed(4));
  }

  const matchFrac = cleanName.match(/^(\d+)[-/](\d+)(?![a-zA-Z])/);
  if (matchFrac) {
    const num = parseFloat(matchFrac[1]);
    const den = parseFloat(matchFrac[2]);
    if (den !== 0) return parseFloat((num / den).toFixed(4));
  }

  const matchDec = cleanName.match(/^(\d+\.\d+)/);
  if (matchDec) {
    return parseFloat(matchDec[1]);
  }

  return 0.75;
}

/**
 * Format decimal inches to standard architectural fraction string
 */
export function formatThicknessFraction(decimalVal) {
  if (!decimalVal && decimalVal !== 0) return '3/4"';
  const val = Number(decimalVal);
  if (Math.abs(val - 0.75) < 0.02) return '3/4"';
  if (Math.abs(val - 0.8125) < 0.015) return '3/4"'; // 3/4" core + 2x laminate faces (0.8125")
  if (Math.abs(val - 0.5) < 0.035 || Math.abs(val - 0.4724) < 0.02) return '1/2"'; // 1/2" or 12mm solid surface
  if (Math.abs(val - 0.25) < 0.02) return '1/4"';
  if (Math.abs(val - 1.0) < 0.02) return '1"';
  if (Math.abs(val - 1.125) < 0.02) return '1 1/8"';
  if (Math.abs(val - 0.375) < 0.02) return '3/8"';
  if (Math.abs(val - 0.625) < 0.02) return '5/8"';
  if (Math.abs(val - 0.9375) < 0.02) return '15/16"';
  return `${parseFloat(val.toFixed(3))}"`;
}

/**
 * Intelligent substrate detector based on material name patterns
 */
export function detectSubstrateFromName(name = '') {
  const u = String(name).toUpperCase();
  if (u.includes('BMCP')) return 'BMCP';
  if (u.includes('WMCP')) return 'WMCP';
  if (u.includes('MCP') || u.includes('MELAMINE')) return 'MCP';
  if (u.includes('MDF')) return 'MDF';
  if (u.includes('PLY') || u.includes('WOOD') || u.includes('MAPLE') || u.includes('OAK') || u.includes('BIRCH')) return 'PLY';
  if (u.includes('CORIAN') || u.includes('SOLID SURFACE') || /\bSS\b/.test(u)) return 'SOLID SURFACE';
  if (u.includes('PB') || u.includes('PARTICLE')) return 'PB';
  return 'PB';
}

/**
 * Parse Job Number, Client, and Project Name from linked folder name
 */
export function parseJobAndProjectFromPath(pathOrFolderName) {
  if (!pathOrFolderName) return { jobNumber: '', jobName: '', client: '' };
  const parts = String(pathOrFolderName).split(/[\\/]/).filter(Boolean);
  const folderName = parts[parts.length - 1] || '';

  const match = folderName.match(/^(\d+-\d+)\s+(.+)$/);
  if (match) {
    const jobNumber = match[1];
    const rest = match[2];
    if (rest.includes(' - ')) {
      const restParts = rest.split(' - ');
      return {
        jobNumber,
        client: restParts[0].trim(),
        jobName: restParts.slice(1).join(' - ').trim(),
      };
    }
    return { jobNumber, jobName: rest.trim(), client: '' };
  }
  return { jobNumber: '', jobName: folderName, client: '' };
}

/**
 * Standardized Shop Description Generator
 * Matches MTO-KOP RD BLD 12.pdf layout conventions
 */
export function formatMtoDescription(item, showSubstrateTag = false) {
  if (item.customOverrideText && item.customOverrideText.trim()) {
    return item.customOverrideText.trim();
  }

  const thickness = item.thickness ? item.thickness.trim() : '';
  const rawMaterialName = item.materialName ? item.materialName.trim() : 'Unspecified Material';
  const sheetSize = item.sheetSize ? item.sheetSize.trim() : '4x8';
  const sides = item.sides ? item.sides.trim() : '';
  const substrate = item.substrate ? item.substrate.trim() : '';

  // Clean leading thickness from material name if thickness is already prefixed
  let materialName = rawMaterialName;
  if (thickness && item.category !== 'loose') {
    const rawThickNoUnit = thickness.replace(/["']/g, '').trim();
    if (rawThickNoUnit) {
      const escaped = rawThickNoUnit.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`^${escaped}[\\s"'-]+`, 'i');
      materialName = materialName.replace(regex, '');
    }
  }

  if (item.category === 'laid_up') {
    if (showSubstrateTag && substrate) {
      // e.g. 3/4" PB Wilsonart Sap Walnut 8221-38 (4x8) 2S
      return [thickness, substrate, materialName, `(${sheetSize})`, sides].filter(Boolean).join(' ');
    }
    // Default PDF format without substrate tag:
    // e.g. 3/4" Wilsonart Sap Walnut 8221-38 (4x8) 2S
    return [thickness, materialName, `(${sheetSize})`, sides].filter(Boolean).join(' ');
  }

  if (item.category === 'loose') {
    // Plain loose sheets — no thickness prefix: e.g. Wilsonart Sap Walnut 8221-38 (4x8) LOOSE SHEET
    return [materialName, `(${sheetSize})`, 'LOOSE SHEET'].filter(Boolean).join(' ');
  }

  if (item.category === 'solid_surface') {
    // e.g. 1/2" Corian Glacier Ice (30x144)
    return [thickness, materialName, `(${sheetSize})`].filter(Boolean).join(' ');
  }

  // Fallback for generic/other items
  return [thickness, substrate, materialName, `(${sheetSize})`, sides].filter(Boolean).join(' ');
}

/**
 * Raw Purchasing Component Breakdown Calculator
 * Explodes laid-up items into raw core substrate sheets and loose laminate face/backer sheets.
 */
export function calculateComponentBreakdown(mtoItems = []) {
  const substratesMap = new Map();
  const laminatesMap = new Map();
  const solidSurfacesMap = new Map();

  for (const item of mtoItems) {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) continue;

    const thickness = item.thickness ? item.thickness.trim() : '';
    const materialName = item.materialName ? item.materialName.trim() : 'Unspecified Material';
    const sheetSize = item.sheetSize ? item.sheetSize.trim() : '4x8';
    let substrate = item.substrate ? item.substrate.trim() : 'PB';
    // If sheet size is 61x109 (MCP) and substrate is default PB or empty, attribute to MCP
    if (sheetSize === '61x109' && (substrate === 'PB' || !substrate)) {
      substrate = 'MCP';
    }
    const sides = (item.sides || '').trim().toUpperCase();

    if (item.category === 'laid_up') {
      // 1. Raw Substrate Core Sheet Breakdown
      const subKey = `${sheetSize} ${thickness} ${substrate}`.trim();
      substratesMap.set(subKey, (substratesMap.get(subKey) || 0) + qty);

      // 2. Face & Backer Sheets
      // For 61x109 MCP boards, shops purchase 5x10 laminate sheets and trim off the last foot
      const lamSheetSize = sheetSize === '61x109' ? '5x10' : sheetSize;
      const faceName = item.faceLaminate || materialName;
      const backName = item.backLaminate || item.faceLaminate || materialName;
      const isSame2S = item.sameOnBothSides !== false;

      if (sides === '2S' || sides === 'GOOD 2 SIDES') {
        if (!isSame2S && item.backLaminate && item.backLaminate !== item.faceLaminate) {
          // Different laminates on face & back: 1 face sheet + 1 back sheet per board
          const faceKey = `${faceName} (${lamSheetSize})`;
          const backKey = `${backName} (${lamSheetSize})`;
          laminatesMap.set(faceKey, (laminatesMap.get(faceKey) || 0) + qty * 1);
          laminatesMap.set(backKey, (laminatesMap.get(backKey) || 0) + qty * 1);
        } else {
          // Same laminate on both sides: 2 decorative sheets per board
          const lamKey = `${faceName} (${lamSheetSize})`;
          laminatesMap.set(lamKey, (laminatesMap.get(lamKey) || 0) + qty * 2);
        }
      } else if (sides === '1S' || sides === 'FACE + BACKER' || sides.includes('1S') || sides.includes('BACKER')) {
        const faceKey = `${faceName} (${lamSheetSize})`;
        const backerType = item.backerType || (item.substrate === 'WMCP' || item.substrate === 'MCP' ? 'WMCP' : 'Standard Backer');
        const backerKey = `${backerType} (${lamSheetSize}) [Shop Stock]`;
        laminatesMap.set(faceKey, (laminatesMap.get(faceKey) || 0) + qty * 1);
        laminatesMap.set(backerKey, (laminatesMap.get(backerKey) || 0) + qty * 1);
      } else {
        // Raw Core Only or unspecified sides
        // No laminate added
      }
    } else if (item.category === 'loose') {
      // Direct loose laminate sheets (if 61x109 specified, maps to 5x10 for purchasing)
      const lamSheetSize = sheetSize === '61x109' ? '5x10' : sheetSize;
      const lamName = item.faceLaminate || materialName;
      const lamKey = `${lamName} (${lamSheetSize})`;
      laminatesMap.set(lamKey, (laminatesMap.get(lamKey) || 0) + qty);
    } else if (item.category === 'solid_surface') {
      const ssKey = `${thickness} ${materialName} (${sheetSize})`.trim();
      solidSurfacesMap.set(ssKey, (solidSurfacesMap.get(ssKey) || 0) + qty);
    } else {
      const otherKey = `${thickness} ${materialName} (${sheetSize})`.trim();
      solidSurfacesMap.set(otherKey, (solidSurfacesMap.get(otherKey) || 0) + qty);
    }
  }

  const substrates = Array.from(substratesMap.entries()).map(([desc, qty]) => ({
    category: 'Raw Substrates (Cores)',
    description: desc,
    qty,
  }));

  const laminates = Array.from(laminatesMap.entries()).map(([desc, qty]) => ({
    category: 'Laminate Sheets (HPL / Backer)',
    description: desc,
    qty,
  }));

  const solidSurfaces = Array.from(solidSurfacesMap.entries()).map(([desc, qty]) => ({
    category: 'Solid Surface / Other Materials',
    description: desc,
    qty,
  }));

  return {
    substrates,
    laminates,
    solidSurfaces,
    allItems: [...substrates, ...laminates, ...solidSurfaces],
  };
}

/**
 * Format hardware line description according to standard syntax:
 * [NAME]-[SIZE (if given)]-[COLOR (if given)]
 */
export function formatHardwareDescription(hw) {
  if (!hw) return '';
  const name = hw.name ? hw.name.trim() : 'Hardware';
  const size = hw.size ? hw.size.trim() : '';
  const color = hw.color ? hw.color.trim() : '';

  const parts = [`[${name}]`];
  if (size) parts.push(`[${size}]`);
  if (color) parts.push(`[${color}]`);

  return parts.join('-');
}

/**
 * Format hardware full takeoff line:
 * [(QTY.)]-[NAME]-[SIZE (if given)]-[COLOR (if given)]
 * Handles pairs or singles, e.g. [(12 PR)]-[Blum 110 Soft-Close Hinges]-[1/2" Overlay]-[Nickel]
 */
export function formatHardwareFullLine(hw) {
  if (!hw) return '';
  const qty = Number(hw.qty) || 1;
  const isPair = Boolean(hw.isPair);
  const qtyStr = isPair ? `${qty} PR` : `${qty}`;
  const qtyPart = `[(${qtyStr})]`;
  const descPart = formatHardwareDescription(hw);

  return `${qtyPart}-${descPart}`;
}

/**
 * Pre-loaded Demo Preset: KOP RD BLD 12
 * Exact historical shop MTO from MTO-KOP RD BLD 12.pdf
 */
export const SAMPLE_MTO_STATE = {
  jobName: 'KOP RD BLD 12',
  jobNumber: '180180-7',
  engineer: 'Sam H',
  date: '06/04/26',
  items: [
    {
      id: 'demo-1',
      source: 'manual',
      category: 'laid_up',
      qty: 1,
      thickness: '3/4"',
      materialName: 'Wilsonart Sap Walnut 8221-38',
      substrate: 'PB',
      sheetSize: '4x8',
      sides: '2S',
      customOverrideText: null,
    },
    {
      id: 'demo-2',
      source: 'manual',
      category: 'laid_up',
      qty: 1,
      thickness: '3/4"',
      materialName: 'Wilsonart Sap Walnut 8221-38',
      substrate: 'PB',
      sheetSize: '5x10',
      sides: '2S',
      customOverrideText: null,
    },
    {
      id: 'demo-3',
      source: 'manual',
      category: 'loose',
      qty: 1,
      thickness: '',
      materialName: 'Wilsonart Sap Walnut 8221-38',
      substrate: '',
      sheetSize: '4x8',
      sides: 'LOOSE SHEET',
      customOverrideText: null,
    },
    {
      id: 'demo-4',
      source: 'manual',
      category: 'loose',
      qty: 1,
      thickness: '',
      materialName: 'Wilsonart Sap Walnut 8221-38',
      substrate: '',
      sheetSize: '5x10',
      sides: 'LOOSE SHEET',
      customOverrideText: null,
    },
    {
      id: 'demo-5',
      source: 'manual',
      category: 'solid_surface',
      qty: 1,
      thickness: '1/2"',
      materialName: 'Corian Glacier Ice',
      substrate: '',
      sheetSize: '30x144',
      sides: '',
      customOverrideText: null,
    },
  ],
  hardware: [
    {
      id: 'demo-hw-1',
      name: 'Blum Clip Top Blumotion 110 Hinges',
      url: 'https://www.blum.com',
      qty: 12,
      isPair: true,
      size: '1/2" Overlay',
      color: 'Nickel',
      image: '',
    },
    {
      id: 'demo-hw-2',
      name: 'Hafele Modern Edge Pulls',
      url: 'https://www.hafele.com',
      qty: 8,
      isPair: false,
      size: '128mm CC',
      color: 'Matte Black',
      image: '',
    },
  ],
};
