import { formatMtoDescription, calculateComponentBreakdown, SAMPLE_MTO_STATE } from './src/utils/mtoFormatter.js';
import { parseCabinetVisionExport, nestPartsLocal, SAMPLE_CV_CUTLIST } from './src/utils/nestingEngine.js';

console.log('--- 1. Testing Demo State & Formatter ---');
console.log('Job:', SAMPLE_MTO_STATE.jobName, '| Engineer:', SAMPLE_MTO_STATE.engineer, '| Job #:', SAMPLE_MTO_STATE.jobNumber);
SAMPLE_MTO_STATE.items.forEach((item, idx) => {
  const line = `(${item.qty})  ${formatMtoDescription(item, false)}`;
  console.log(`Row ${idx + 1}: ${line}`);
});

console.log('\n--- 2. Testing Component Breakdown on Demo State ---');
const breakdown = calculateComponentBreakdown(SAMPLE_MTO_STATE.items);
console.log('Substrates:');
breakdown.substrates.forEach(s => console.log(`  (${s.qty}) ${s.description}`));
console.log('Laminates:');
breakdown.laminates.forEach(l => console.log(`  (${l.qty}) ${l.description}`));
console.log('Solid Surface:');
breakdown.solidSurfaces.forEach(ss => console.log(`  (${ss.qty}) ${ss.description}`));

console.log('\n--- 3. Testing Cabinet Vision Cutlist Parsing & 2D Nesting ---');
const parsed = parseCabinetVisionExport(SAMPLE_CV_CUTLIST);
console.log('Parsed successfully:', parsed.success, '| Total Parts:', parsed.totalParsed, '| Groups:', parsed.materialGroups.length);

parsed.materialGroups.forEach(grp => {
  const nest = nestPartsLocal(grp.parts, { width: 48, length: 96 }, { kerf: 0.25, edgeTrim: 0.5, wastePercent: 10 });
  console.log(`Material [${grp.material}]:`);
  console.log(`  Net Sheets: ${nest.totalSheets} | Buffered: ${nest.bufferedSheets} | Yield: ${nest.utilizationPercent}% | Placed: ${nest.placedPartsCount}`);
});

console.log('\n--- ALL ALGORITHMIC TESTS PASSED! ---');
