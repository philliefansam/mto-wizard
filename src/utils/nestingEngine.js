import { parsePncBinary } from './pncParser.js';

export { parsePncBinary };

/**
 * Parse string dimensions (decimal, fraction, mixed fraction, or unit-suffixed)
 * e.g. "30.5", "30 1/2", "30-1/2", "30 3/8\"", "762mm"
 */
export function parseDimension(value, unit = 'in') {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  let str = String(value).trim().replace(/["']/g, '');

  // Detect millimeter suffix
  let isMm = unit === 'mm';
  if (str.toLowerCase().endsWith('mm')) {
    isMm = true;
    str = str.replace(/mm/gi, '').trim();
  }

  let num = 0;
  // Check for mixed fraction: "30 1/2" or "30-1/2"
  const mixedParts = str.split(/[\s-]+/);
  if (mixedParts.length === 2 && mixedParts[1].includes('/')) {
    const whole = parseFloat(mixedParts[0]) || 0;
    const [numer, denom] = mixedParts[1].split('/').map(Number);
    num = whole + (denom ? numer / denom : 0);
  } else if (str.includes('/')) {
    const [numer, denom] = str.split('/').map(Number);
    num = denom ? numer / denom : 0;
  } else {
    num = parseFloat(str) || 0;
  }

  return isMm ? num / 25.4 : num;
}

/**
 * Parse Cabinet Vision CSV / TXT / TSV cutlist export
 */
export function parseCabinetVisionExport(rawText, defaultUnit = 'in') {
  if (!rawText || !rawText.trim()) {
    return { success: false, error: 'Empty file contents' };
  }

  // Detect delimiter: comma, tab, or semicolon
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { success: false, error: 'File must contain at least a header row and one data row.' };
  }

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  // Robust character-by-character parser that preserves unquoted inch marks (e.g. 3/4" PB)
  const parseLine = (line) => {
    if (delimiter === '\t') return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (delimiter === ';') return line.split(';').map((c) => c.trim().replace(/^"|"$/g, ''));

    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (!inQuotes && current.trim().length === 0) {
          inQuotes = true;
          continue;
        } else if (inQuotes) {
          if (nextChar === '"') {
            current += '"';
            i++;
            continue;
          } else if (nextChar === ',' || nextChar === undefined || i === line.length - 1) {
            inQuotes = false;
            continue;
          }
        }
      }

      if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(firstLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Header field finder - require exact match for short abbreviations (e.g. 'l', 'w')
  const findIndex = (patterns) => {
    return headers.findIndex((h) =>
      patterns.some((p) => (p.length <= 2 ? h === p : h.includes(p)))
    );
  };

  const nameIdx = findIndex(['partname', 'part', 'description', 'label', 'piecename']);
  const matIdx = findIndex(['material', 'mat', 'code', 'matname']);
  const lenIdx = findIndex(['length', 'len', 'height', 'cutlength', 'l']);
  const widIdx = findIndex(['width', 'wid', 'cutwidth', 'w']);
  const qtyIdx = findIndex(['qty', 'quantity', 'count', 'piececount']);
  const grainIdx = findIndex(['grain', 'rotation', 'rotate', 'graindirection']);
  const asmIdx = findIndex(['cabinet', 'assembly', 'cabname', 'cab']);
  const asmNumIdx = findIndex(['cab#', 'cabno', 'cabnum', 'assembly#', 'cabinet#']);
  const internalIdx = findIndex(['internalname', 'parttype', 'type', 'internal', 'code']);

  const parts = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    if (row.length === 0 || row.every((c) => !c)) continue;

    const rawName = nameIdx !== -1 ? row[nameIdx] : `Part ${i}`;
    const rawMat = matIdx !== -1 ? row[matIdx] : 'Default Material';
    const rawLen = lenIdx !== -1 ? row[lenIdx] : 0;
    const rawWid = widIdx !== -1 ? row[widIdx] : 0;
    const rawQty = qtyIdx !== -1 ? parseInt(row[qtyIdx], 10) : 1;
    const rawGrain = grainIdx !== -1 ? row[grainIdx] : 'Y';

    let partName = rawName || `Part ${i}`;
    let internalName = internalIdx !== -1 ? (row[internalIdx] || '').trim() : '';
    let assemblyName = asmIdx !== -1 ? (row[asmIdx] || '').trim() : '';
    let assemblyNumber = asmNumIdx !== -1 ? parseInt(row[asmNumIdx], 10) || null : null;

    if (!assemblyName || !assemblyNumber) {
      const m = String(rawName).match(/^(.*?)(?:\s+#?(\d+))?\s*(?:—|-)\s*(.*?)(?:\s*\((.*?)\))?$/);
      if (m) {
        if (!assemblyName) assemblyName = m[1]?.trim() || '';
        if (!assemblyNumber && m[2]) assemblyNumber = parseInt(m[2], 10);
        if (m[3]) partName = m[3].trim();
        if (!internalName && m[4]) internalName = m[4].trim();
      }
    }

    const length = parseDimension(rawLen, defaultUnit);
    const width = parseDimension(rawWid, defaultUnit);
    const qty = Math.max(1, isNaN(rawQty) ? 1 : rawQty);

    const grainStr = String(rawGrain).toLowerCase();
    const grainLocked = grainStr === '1' || grainStr === 'y' || grainStr === 'yes' || grainStr === 'true' || grainStr === 'length';

    if (length <= 0 || width <= 0) {
      errors.push(`Row ${i + 1} skipped: invalid dimensions (${rawLen} x ${rawWid})`);
      continue;
    }

    parts.push({
      id: `cv-${i}-${Date.now()}`,
      name: rawName || `Part ${i}`,
      partName,
      internalName,
      assemblyName,
      assemblyNumber,
      material: rawMat || 'Default Material',
      length,
      width,
      qty,
      grainLocked,
      areaSqFt: (length * width * qty) / 144,
    });
  }

  // Group by material
  const grouped = {};
  for (const p of parts) {
    if (!grouped[p.material]) {
      grouped[p.material] = {
        material: p.material,
        parts: [],
        totalParts: 0,
        totalSqFt: 0,
      };
    }
    grouped[p.material].parts.push(p);
    grouped[p.material].totalParts += p.qty;
    grouped[p.material].totalSqFt += p.areaSqFt;
  }

  return {
    success: true,
    totalParsed: parts.length,
    parts,
    materialGroups: Object.values(grouped),
    errors,
  };
}

/**
 * 2D Guillotine Bin Packer (Local Offline Nesting)
 */
export function nestPartsLocal(parts, stockSheet = { width: 48, length: 96 }, options = {}) {
  const kerf = options.kerf !== undefined ? Number(options.kerf) : 0.25;
  const edgeTrim = options.edgeTrim !== undefined ? Number(options.edgeTrim) : 0.5;
  const wastePercent = options.wastePercent !== undefined ? Number(options.wastePercent) : 10;

  const usableW = stockSheet.width - edgeTrim * 2;
  const usableL = stockSheet.length - edgeTrim * 2;

  if (usableW <= 0 || usableL <= 0) {
    return { success: false, error: 'Usable sheet size is non-positive after edge trim.' };
  }

  // 1. Expand part instances
  const instances = [];
  for (const p of parts) {
    const qty = Number(p.qty) || 1;
    for (let q = 0; q < qty; q++) {
      instances.push({
        id: `${p.id || 'p'}_${q}`,
        originalPartId: p.id || 'p',
        name: p.name || 'Part',
        partName: p.partName || p.name || 'Part',
        internalName: p.internalName || '',
        assemblyName: p.assemblyName || '',
        assemblyNumber: p.assemblyNumber !== undefined && p.assemblyNumber !== null ? p.assemblyNumber : null,
        length: Number(p.length),
        width: Number(p.width),
        grainLocked: Boolean(p.grainLocked),
        material: p.material,
      });
    }
  }

  // 2. Sort by area descending, then max dimension descending
  instances.sort((a, b) => {
    const areaA = a.length * a.width;
    const areaB = b.length * b.width;
    if (areaB !== areaA) return areaB - areaA;
    return Math.max(b.length, b.width) - Math.max(a.length, a.width);
  });

  const sheets = [];
  const unplacedParts = [];

  const createSheet = (sheetIndex) => ({
    sheetIndex,
    width: stockSheet.width,
    length: stockSheet.length,
    edgeTrim,
    freeRects: [
      {
        x: edgeTrim,
        y: edgeTrim,
        w: usableL, // length along X axis
        h: usableW, // width along Y axis
      },
    ],
    placedParts: [],
  });

  // Helper to place item in sheet
  for (const part of instances) {
    let placed = false;

    // Check existing sheets
    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx];
      let bestRectIdx = -1;
      let bestFitScore = Infinity;
      let shouldRotate = false;

      for (let rIdx = 0; rIdx < sheet.freeRects.length; rIdx++) {
        const rect = sheet.freeRects[rIdx];

        // Try normal fit (length along X, width along Y)
        const fitsNormal = part.length <= rect.w + 0.001 && part.width <= rect.h + 0.001;
        // Try rotated fit (width along X, length along Y)
        const fitsRotated =
          !part.grainLocked && part.width <= rect.w + 0.001 && part.length <= rect.h + 0.001;

        if (fitsNormal) {
          const leftoverArea = rect.w * rect.h - part.length * part.width;
          if (leftoverArea < bestFitScore) {
            bestFitScore = leftoverArea;
            bestRectIdx = rIdx;
            shouldRotate = false;
          }
        }
        if (fitsRotated) {
          const leftoverArea = rect.w * rect.h - part.width * part.length;
          if (leftoverArea < bestFitScore) {
            bestFitScore = leftoverArea;
            bestRectIdx = rIdx;
            shouldRotate = true;
          }
        }
      }

      if (bestRectIdx !== -1) {
        const targetRect = sheet.freeRects.splice(bestRectIdx, 1)[0];
        const partW = shouldRotate ? part.width : part.length;
        const partH = shouldRotate ? part.length : part.width;

        sheet.placedParts.push({
          id: part.id,
          originalPartId: part.originalPartId || part.id,
          name: part.name,
          partName: part.partName || part.name,
          internalName: part.internalName || '',
          assemblyName: part.assemblyName || '',
          assemblyNumber: part.assemblyNumber || null,
          length: part.length,
          width: part.width,
          x: targetRect.x,
          y: targetRect.y,
          w: partW,
          h: partH,
          rotated: shouldRotate,
          grainLocked: part.grainLocked,
        });

        // Guillotine split: split along the shorter residual axis
        const remainingW = targetRect.w - partW - kerf;
        const remainingH = targetRect.h - partH - kerf;

        if (remainingW > 0.1 && targetRect.h > 0.1) {
          sheet.freeRects.push({
            x: targetRect.x + partW + kerf,
            y: targetRect.y,
            w: remainingW,
            h: partH, // shorter guillotine
          });
        }
        if (remainingH > 0.1 && targetRect.w > 0.1) {
          sheet.freeRects.push({
            x: targetRect.x,
            y: targetRect.y + partH + kerf,
            w: targetRect.w,
            h: remainingH,
          });
        }

        placed = true;
        break;
      }
    }

    if (!placed) {
      // Check if the part can even fit on an empty sheet
      const fitsNormal = part.length <= usableL + 0.001 && part.width <= usableW + 0.001;
      const fitsRotated =
        !part.grainLocked && part.width <= usableL + 0.001 && part.length <= usableW + 0.001;

      if (!fitsNormal && !fitsRotated) {
        unplacedParts.push({
          ...part,
          reason: `Part (${part.length}" x ${part.width}") exceeds usable sheet bounds (${usableL}" x ${usableW}")`,
        });
        continue;
      }

      // Create new sheet
      const newSheet = createSheet(sheets.length + 1);
      const targetRect = newSheet.freeRects.shift();
      const shouldRotate = !fitsNormal && fitsRotated;
      const partW = shouldRotate ? part.width : part.length;
      const partH = shouldRotate ? part.length : part.width;

      newSheet.placedParts.push({
        id: part.id,
        originalPartId: part.originalPartId || part.id,
        name: part.name,
        partName: part.partName || part.name,
        internalName: part.internalName || '',
        assemblyName: part.assemblyName || '',
        assemblyNumber: part.assemblyNumber || null,
        length: part.length,
        width: part.width,
        x: targetRect.x,
        y: targetRect.y,
        w: partW,
        h: partH,
        rotated: shouldRotate,
        grainLocked: part.grainLocked,
      });

      const remainingW = targetRect.w - partW - kerf;
      const remainingH = targetRect.h - partH - kerf;

      if (remainingW > 0.1) {
        newSheet.freeRects.push({
          x: targetRect.x + partW + kerf,
          y: targetRect.y,
          w: remainingW,
          h: partH,
        });
      }
      if (remainingH > 0.1) {
        newSheet.freeRects.push({
          x: targetRect.x,
          y: targetRect.y + partH + kerf,
          w: targetRect.w,
          h: remainingH,
        });
      }

      sheets.push(newSheet);
      placed = true;
    }
  }

  const totalSheets = sheets.length;
  const totalNetPartArea = instances
    .filter((p) => !unplacedParts.some((up) => up.id === p.id))
    .reduce((sum, p) => sum + p.length * p.width, 0);
  const singleSheetArea = stockSheet.width * stockSheet.length;
  const totalSheetArea = totalSheets * singleSheetArea;
  const utilizationPercent = totalSheetArea > 0 ? (totalNetPartArea / totalSheetArea) * 100 : 0;

  // Buffer Calculation:
  // Options: bufferMode = 'area' (default) | 'flat' | 'net'
  const bufferMode = options.bufferMode || 'area';
  let bufferedSheets = totalSheets;

  if (wastePercent > 0 && totalSheets > 0) {
    if (bufferMode === 'net') {
      bufferedSheets = totalSheets;
    } else if (bufferMode === 'flat') {
      // Flat sheet multiplier: ceil only if fractional excess exceeds 0.2
      const raw = totalSheets * (1 + wastePercent / 100);
      bufferedSheets = Math.max(totalSheets, Math.ceil(raw - 0.2));
    } else {
      // 'area' mode: Smart Offcut Yield Buffer.
      // The unused offcut already in the nested sheets is used first.
      // E.g., if 3 sheets have 57% yield, 43% is already offcut/waste room!
      const bufferAreaNeeded = totalNetPartArea * (wastePercent / 100);
      const availableOffcut = Math.max(0, totalSheetArea - totalNetPartArea);
      if (bufferAreaNeeded > availableOffcut && singleSheetArea > 0) {
        const extraAreaNeeded = bufferAreaNeeded - availableOffcut;
        const extraSheets = Math.ceil(extraAreaNeeded / singleSheetArea);
        bufferedSheets = totalSheets + extraSheets;
      } else {
        bufferedSheets = totalSheets;
      }
    }
  }

  return {
    success: true,
    totalSheets,
    bufferedSheets,
    utilizationPercent: Number(utilizationPercent.toFixed(1)),
    totalPartsCount: instances.length,
    placedPartsCount: instances.length - unplacedParts.length,
    unplacedParts,
    sheets,
    stockSheet,
  };
}

/**
 * Smartcut.dev API Integration Client
 */
export async function nestPartsSmartcut(parts, stockSheet, options, apiKey) {
  if (!apiKey) {
    console.info('No Smartcut API key provided. Falling back to local offline nesting.');
    return nestPartsLocal(parts, stockSheet, options);
  }

  try {
    const payload = {
      panels: parts.map((p) => ({
        length: p.length,
        width: p.width,
        count: p.qty,
        canRotate: !p.grainLocked,
        label: p.name,
      })),
      sheets: [
        {
          length: stockSheet.length,
          width: stockSheet.width,
          trim: options.edgeTrim || 0.5,
          count: 999,
        },
      ],
      settings: {
        bladeWidth: options.kerf || 0.25,
      },
    };

    const res = await fetch('https://api.smartcut.dev/v1/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Smartcut API returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      isCloud: true,
      totalSheets: data.totalSheets || data.sheets?.length || 1,
      bufferedSheets: Math.ceil((data.totalSheets || 1) * (1 + (options.wastePercent || 10) / 100)),
      utilizationPercent: data.efficiency || 85.0,
      sheets: data.sheets || [],
      raw: data,
    };
  } catch (err) {
    console.warn('Smartcut API request failed, falling back to local nesting:', err);
    const local = nestPartsLocal(parts, stockSheet, options);
    local.cloudError = err.message;
    return local;
  }
}

/**
 * Sample Cabinet Vision Cutlist for 1-click test load
 */
export const SAMPLE_CV_CUTLIST = `Part Name,Material,Length,Width,Qty,Grain
C-01 Top,3/4" PB Wilsonart Sap Walnut,34.5,23.25,2,Y
C-01 Bottom,3/4" PB Wilsonart Sap Walnut,34.5,23.25,2,Y
C-01 Left End,3/4" PB Wilsonart Sap Walnut,30.5,24.0,2,Y
C-01 Right End,3/4" PB Wilsonart Sap Walnut,30.5,24.0,2,Y
C-01 Shelf,3/4" PB Wilsonart Sap Walnut,33.0,22.5,4,Y
C-01 Stretchers,3/4" PB Wilsonart Sap Walnut,33.0,4.0,4,N
C-01 Valance,3/4" Solid Maple,36.0,4.5,2,Y
CT-01 Countertop,1/2" Corian Glacier Ice,72.0,25.5,1,N
C-01 Backer,Standard Backer,34.5,29.5,2,N`;
