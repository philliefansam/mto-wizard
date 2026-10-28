import { Buffer } from 'buffer';
import MDBReader from 'mdb-reader';

// Ensure Buffer is available in global browser scope for mdb-reader
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}
if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

/**
 * Parse a Cabinet Vision / S2M .pnc (Package NC / Part NC) database file
 * @param {ArrayBuffer|Uint8Array|Buffer} data - Binary content of the .pnc file
 * @returns {Object} Parsed job, materials, assemblies, and cutlist parts grouped by material
 */
export function parsePncBinary(data) {
  try {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const reader = new MDBReader(buf);
    const tableNames = reader.getTableNames();

    if (!tableNames.includes('Parts')) {
      return {
        success: false,
        error: 'Invalid .PNC file: Missing "Parts" database table.',
      };
    }

    // 1. Parse Job Info
    let jobInfo = {
      jobName: '',
      jobNumber: '',
      client: '',
      description: '',
      jobFilePath: '',
    };

    if (tableNames.includes('Jobs')) {
      const jobsTable = reader.getTable('Jobs');
      const jobsData = jobsTable.getData();
      if (jobsData && jobsData.length > 0) {
        const j = jobsData[0];
        jobInfo.jobName = j.Name || '';
        jobInfo.description = j.Description || '';
        jobInfo.client = j.CustName || '';
        jobInfo.jobFilePath = j.JobFilePath || '';

        // Extract job number from Description (e.g. "Futrus-Two Kings-182097-1" -> "182097-1")
        const descMatch = (j.Description || '').match(/\b(\d+-\d+)\b/);
        if (descMatch) {
          jobInfo.jobNumber = descMatch[1];
        } else {
          // Check JobFilePath (e.g. ".../182097-1 Two Kings.../...")
          const pathMatch = (j.JobFilePath || '').match(/\b(\d+-\d+)\b/);
          if (pathMatch) {
            jobInfo.jobNumber = pathMatch[1];
          }
        }
      }
    }

    // 2. Parse Materials
    const materialsMap = new Map();
    const materialsList = [];

    if (tableNames.includes('Materials')) {
      const matTable = reader.getTable('Materials');
      const matData = matTable.getData();
      for (const m of matData) {
        const matObj = {
          id: m.ID,
          matDbId: m.MatDBID,
          name: (m.Name || 'Default Material').trim(),
          description: (m.Description || '').trim(),
          width: Number(m.Width) || 48,
          length: Number(m.Length) || 96,
          thick: Number(m.Thick) || 0.75,
          grain: Boolean(m.Grain),
          textureFace: m.TextureFace || '',
          textureBack: m.TextureBack || '',
          textureEdge: m.TextureEdge || '',
        };
        materialsMap.set(m.MatDBID, matObj);
        materialsList.push(matObj);
      }
    }

    // 3. Parse Assemblies
    const assembliesMap = new Map();
    if (tableNames.includes('Assemblies')) {
      const asmTable = reader.getTable('Assemblies');
      const asmData = asmTable.getData();
      for (const a of asmData) {
        assembliesMap.set(a.ID, {
          id: a.ID,
          number: a.Number,
          name: a.Name || `Cabinet ${a.Number || a.ID}`,
          description: a.Description || '',
          width: Number(a.Width) || 0,
          height: Number(a.Height) || 0,
          depth: Number(a.Depth) || 0,
        });
      }
    }

    // 4. Parse Parts
    const partsTable = reader.getTable('Parts');
    const rawParts = partsTable.getData();
    const parsedParts = [];

    for (let i = 0; i < rawParts.length; i++) {
      const p = rawParts[i];
      const mat = materialsMap.get(p.MatDBID) || {
        name: 'Default Material',
        width: 48,
        length: 96,
        thick: 0.75,
        grain: true,
      };

      const asm = assembliesMap.get(p.AssemblyID) || null;

      const length = Math.abs(Number(p.Length) || 0);
      const width = Math.abs(Number(p.Width) || 0);
      const qty = Math.max(1, parseInt(p.Qty, 10) || 1);

      if (length <= 0 || width <= 0) continue;

      const partName = p.Name ? p.Name.trim() : `Part ${i + 1}`;
      const internalName = p.InternalName ? p.InternalName.trim() : '';
      const fullLabel = asm
        ? `${asm.name} #${asm.number} — ${partName}${internalName ? ` (${internalName})` : ''}`
        : `${partName}${internalName ? ` (${internalName})` : ''}`;

      parsedParts.push({
        id: `pnc-${p.ID || i}-${Date.now()}`,
        name: fullLabel,
        partName,
        internalName,
        assemblyName: asm ? asm.name : '',
        assemblyNumber: asm ? asm.number : null,
        material: mat.name,
        materialDescription: mat.description,
        materialSheetWidth: mat.width,
        materialSheetLength: mat.length,
        materialThickness: mat.thick,
        length: parseFloat(length.toFixed(4)),
        width: parseFloat(width.toFixed(4)),
        qty,
        grainLocked: Boolean(mat.grain),
        areaSqFt: (length * width * qty) / 144,
        banding: p.Banding || '',
        bandingCode: p.BandingCode || '',
        finishFace: p.FinishFace || '',
        finishBack: p.FinishBack || '',
        finishEdge: p.FinishEdge || '',
      });
    }

    // 5. Group by material
    const grouped = {};
    for (const p of parsedParts) {
      if (!grouped[p.material]) {
        grouped[p.material] = {
          material: p.material,
          materialDescription: p.materialDescription,
          defaultSheetSize: detectSheetSizeString(p.materialSheetWidth, p.materialSheetLength),
          sheetWidth: p.materialSheetWidth,
          sheetLength: p.materialSheetLength,
          thickness: p.materialThickness,
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
      fileType: 'pnc',
      jobInfo,
      materials: materialsList,
      assemblies: Array.from(assembliesMap.values()),
      totalParsed: parsedParts.length,
      parts: parsedParts,
      materialGroups: Object.values(grouped),
      errors: [],
    };
  } catch (err) {
    console.error('Error parsing .pnc binary:', err);
    return {
      success: false,
      error: `Failed to parse .PNC database: ${err.message}`,
    };
  }
}

/**
 * Helper to match standard sheet size labels (e.g. 4x8, 5x10, 30x144) from raw sheet dimensions
 */
function detectSheetSizeString(width, length) {
  const w = Math.round(width);
  const l = Math.round(length);

  if ((w === 48 || w === 49) && (l === 96 || l === 97)) return '4x8';
  if ((w === 60 || w === 61) && (l === 120 || l === 121)) return '5x10';
  if ((w === 60 || w === 61) && (l === 144 || l === 145)) return '5x12';
  if (w <= 36 && l >= 140) return '30x144';

  if (w <= 50 && l <= 100) return '4x8';
  if (w <= 62 && l <= 122) return '5x10';
  return '4x8';
}
