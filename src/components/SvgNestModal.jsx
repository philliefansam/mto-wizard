import React, { useState } from 'react';
import Icon from './Icon';

// Standard Cabinet Vision part identifier resolver
function getPartIdentifier(partName = '', internalName = '') {
  if (internalName && String(internalName).trim().length <= 5) {
    return String(internalName).trim().toUpperCase();
  }
  const clean = String(partName || '').trim().toLowerCase();
  if (clean.includes('finished left') || clean.includes('left end')) return 'LE';
  if (clean.includes('finished right') || clean.includes('right end')) return 'RE';
  if (clean.includes('top stretcher')) return 'TS';
  if (clean.includes('back stretcher')) return 'BS';
  if (clean.includes('front stretcher')) return 'FS';
  if (clean.includes('stretcher')) return 'STR';
  if (clean.includes('bottom') || clean.includes('deck')) return 'DE';
  if (clean.includes('shelf')) return 'SH';
  if (clean.includes('drawer') || clean.includes('sub front') || clean.includes('drawer face')) return 'DW';
  if (clean.includes('door') || clean.includes('slab door')) return 'DR';
  if (clean.includes('back')) return 'BK';
  if (clean.includes('divider') || clean.includes('partition')) return 'DIV';
  if (clean.includes('toe') || clean.includes('kick')) return 'TK';
  if (clean.includes('filler')) return 'FIL';
  if (clean.includes('countertop') || clean.includes('solid surface') || clean.includes('top')) return 'TOP';

  if (internalName) {
    const alnum = String(internalName).replace(/[^a-zA-Z0-9]/g, '');
    if (alnum) return alnum.substring(0, 4).toUpperCase();
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => w[0]).join('').substring(0, 3).toUpperCase();
  }
  return clean.substring(0, 3).toUpperCase();
}

function renderPartLabel(part, isHovered) {
  const w = part.w; // length along X axis
  const h = part.h; // width along Y axis
  const cx = part.x + w / 2;
  const cy = part.y + h / 2;

  // Follow the direction of whichever is the longer dimension:
  // If h > w and significantly non-square, rotate -90 deg so text runs along the vertical axis.
  // For square or nearly square parts (diff <= 2.5"), keep horizontal.
  const isVertical = h > w && (h - w > 2.5);
  const L = isVertical ? h : w; // length along text reading axis
  const W = isVertical ? w : h; // thickness perpendicular to text axis

  const identifier = getPartIdentifier(part.partName, part.internalName);
  const cabNumStr = part.assemblyNumber ? `#${part.assemblyNumber}` : '';
  const cleanPartName = (part.partName || part.name || 'Part').trim();

  // Primary label: Part Name + Cab # (e.g. "Finished Left End #1")
  const primaryFull = `${cleanPartName}${cabNumStr ? ` ${cabNumStr}` : ''}`;
  // Compact label: Identifier + Cab # (e.g. "LE #1")
  const compactLabel = `${identifier}${cabNumStr ? ` ${cabNumStr}` : ''}`;

  // Font size calculation:
  // In SVG coordinates (sheet is e.g. 96" x 48"):
  // Max font size: 2.3", Min readable floor: 0.85"
  const approxCharW = 0.52;
  const availL = Math.max(0.5, L - 1.2);
  const availW = Math.max(0.5, W - 0.7);

  // Can full name fit without shrinking below 0.95"?
  const fitFullFontSize = Math.min(availL / (primaryFull.length * approxCharW), availW * 0.42, 2.3);

  let displayText = primaryFull;
  let fontSize = fitFullFontSize;
  let showDimensions = false;

  if (fitFullFontSize >= 0.95) {
    displayText = primaryFull;
    fontSize = Math.min(fitFullFontSize, 2.2);
    // If there is generous cross thickness, show dimensions on second line
    if (availW >= 4.5 && availL >= 12 && fontSize >= 1.2) {
      showDimensions = true;
    }
  } else {
    // Squeeze or fallback to compact identifier (e.g. "LE #1")
    const fitCompactFontSize = Math.min(availL / (compactLabel.length * approxCharW), availW * 0.55, 1.8);
    displayText = compactLabel;
    fontSize = Math.max(0.85, fitCompactFontSize);
  }

  // If part is extremely tiny (e.g. L < 2.5 or W < 1.2), don't show text to avoid illegible overflow
  if (L < 2.5 || W < 1.2) {
    return null;
  }

  const transform = isVertical ? `rotate(-90 ${cx} ${cy})` : undefined;

  return (
    <g transform={transform} pointerEvents="none" className="select-none">
      {showDimensions ? (
        <>
          <text
            x={cx}
            y={cy - fontSize * 0.55}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0f172a"
            fontSize={fontSize}
            fontWeight="700"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {displayText}
          </text>
          <text
            x={cx}
            y={cy + fontSize * 0.7}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#475569"
            fontSize={Math.max(0.75, fontSize * 0.72)}
            fontFamily="monospace"
            fontWeight="500"
          >
            {w.toFixed(1)}" × {h.toFixed(1)}" {part.rotated ? '↻' : ''}
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0f172a"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {displayText}
        </text>
      )}
    </g>
  );
}

export default function SvgNestModal({ nestResult, materialName, onUnlockGrain, onClose }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [hoveredPart, setHoveredPart] = useState(null);

  if (!nestResult || !nestResult.sheets || nestResult.sheets.length === 0) {
    return null;
  }

  const currentSheet = nestResult.sheets[activeSheetIndex] || nestResult.sheets[0];
  const totalSheets = nestResult.sheets.length;

  // Stock Sheet Dimensions in inches
  const sheetWidth = currentSheet.width || nestResult.stockSheet?.width || 48; // Y axis
  const sheetLength = currentSheet.length || nestResult.stockSheet?.length || 96; // X axis

  // SVG viewBox aspect ratio
  // X axis = Length (e.g. 96" or 120"), Y axis = Width (e.g. 48" or 60")
  const viewBoxW = sheetLength;
  const viewBoxH = sheetWidth;

  const handlePartContextMenu = (e, part) => {
    e.preventDefault();
    e.stopPropagation();
    if (onUnlockGrain) {
      onUnlockGrain(part, materialName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202124]/75 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-[#e0e5ec] dark:bg-[#202124] rounded-2xl p-5 max-w-5xl w-full neu-flat border border-slate-300/60 dark:border-[#3c4043] shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-[#3c4043]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Icon name="layers" className="text-xl text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-geometric">
                SVG Nest Preview: {materialName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sheet {activeSheetIndex + 1} of {totalSheets} | Size: {sheetWidth}" × {sheetLength}" | Utilization: {nestResult.utilizationPercent}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="neu-icon-btn w-9 h-9 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
            title="Close Preview"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Sheet Navigation Strip */}
        <div className="py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveSheetIndex((prev) => Math.max(0, prev - 1));
                setHoveredPart(null);
              }}
              disabled={activeSheetIndex === 0}
              className="neu-btn px-2.5 py-1 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
            >
              <Icon name="chevron_left" className="text-base" />
              <span>Prev Sheet</span>
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
              Sheet {activeSheetIndex + 1} / {totalSheets}
            </span>
            <button
              onClick={() => {
                setActiveSheetIndex((prev) => Math.min(totalSheets - 1, prev + 1));
                setHoveredPart(null);
              }}
              disabled={activeSheetIndex === totalSheets - 1}
              className="neu-btn px-2.5 py-1 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
            >
              <span>Next Sheet</span>
              <Icon name="chevron_right" className="text-base" />
            </button>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
            Parts placed on this sheet: <span className="font-mono text-blue-700 dark:text-blue-400">{currentSheet.placedParts.length}</span>
          </div>
        </div>

        {/* Interactive Part Inspector HUD Banner */}
        <div className="mb-2.5 p-2.5 rounded-xl bg-slate-100/90 dark:bg-[#1a1b1e] border border-slate-300/60 dark:border-[#3c4043] flex flex-wrap items-center justify-between gap-3 text-xs min-h-[46px] transition-all">
          {hoveredPart ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <span className="font-bold text-slate-900 dark:text-slate-100 font-geometric text-sm">
                  {hoveredPart.partName || hoveredPart.name}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono">
                  {getPartIdentifier(hoveredPart.partName, hoveredPart.internalName)}
                </span>
                {hoveredPart.assemblyNumber && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-mono">
                    Cab #{hoveredPart.assemblyNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-[11px]">
                {hoveredPart.assemblyName && (
                  <span>
                    <strong>Cabinet:</strong> {hoveredPart.assemblyName}
                  </span>
                )}
                <span>
                  <strong>Cut Size:</strong> {hoveredPart.w.toFixed(1)}" × {hoveredPart.h.toFixed(1)}"
                </span>
                <span className="font-mono">
                  ({((hoveredPart.w * hoveredPart.h) / 144).toFixed(2)} sq ft)
                </span>
                {hoveredPart.rotated && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                    Rotated 90°
                  </span>
                )}
                {hoveredPart.grainLocked ? (
                  <span
                    onClick={(e) => handlePartContextMenu(e, hoveredPart)}
                    className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold cursor-pointer hover:bg-amber-200 transition-colors flex items-center gap-1 shadow-xs"
                    title="Right-click part on sheet (or click here) to unlock grain and re-nest sheet"
                  >
                    <Icon name="lock" className="text-xs" />
                    <span>Grain Locked (Right-Click to Unlock)</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                    <Icon name="lock_open" className="text-xs" />
                    <span>Free Grain</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
              <Icon name="info" className="text-base text-blue-600 dark:text-blue-400" />
              <span>
                Hover over parts to inspect specs. <strong>Right-click any part to unlock its grain direction &amp; re-nest the sheet.</strong>
              </span>
            </div>
          )}
        </div>

        {/* Canvas / SVG Render Area */}
        <div className="flex-1 min-h-[300px] overflow-hidden rounded-xl neu-pressed p-4 flex items-center justify-center bg-[#d8dee8] dark:bg-[#18191b]">
          <svg
            viewBox={`-2 -2 ${viewBoxW + 4} ${viewBoxH + 4}`}
            className="w-full h-full max-h-[55vh] select-none"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Stock Sheet Base */}
            <rect
              x="0"
              y="0"
              width={sheetLength}
              height={sheetWidth}
              fill="#f1f5f9"
              stroke="#64748b"
              strokeWidth="0.5"
              rx="0.5"
            />

            {/* Edge Trim Border (Dashed) */}
            {currentSheet.edgeTrim > 0 && (
              <rect
                x={currentSheet.edgeTrim}
                y={currentSheet.edgeTrim}
                width={sheetLength - currentSheet.edgeTrim * 2}
                height={sheetWidth - currentSheet.edgeTrim * 2}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.25"
                strokeDasharray="1,1"
              />
            )}

            {/* Placed Parts */}
            {currentSheet.placedParts.map((part, pIdx) => {
              const isHovered = hoveredPart?.id === part.id;
              const hue = (pIdx * 47) % 360;
              const identifier = getPartIdentifier(part.partName, part.internalName);
              const cabNumStr = part.assemblyNumber ? `#${part.assemblyNumber}` : '';

              return (
                <g
                  key={part.id || pIdx}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredPart(part)}
                  onMouseLeave={() => setHoveredPart(null)}
                  onContextMenu={(e) => handlePartContextMenu(e, part)}
                >
                  <title>
                    {`Part: ${part.partName || part.name} (${identifier})\n` +
                      `Cabinet: ${part.assemblyName || '—'} ${cabNumStr}\n` +
                      `Cut Size: ${part.w.toFixed(1)}" × ${part.h.toFixed(1)}" (${((part.w * part.h) / 144).toFixed(2)} sq ft)\n` +
                      `${part.rotated ? 'Rotated 90° · ' : ''}${part.grainLocked ? 'Grain Locked (Right-Click to Unlock)' : 'Free Grain'}`}
                  </title>
                  <rect
                    x={part.x}
                    y={part.y}
                    width={part.w}
                    height={part.h}
                    fill={isHovered ? `hsl(${hue}, 85%, 85%)` : `hsl(${hue}, 60%, 92%)`}
                    stroke={isHovered ? '#2563eb' : `hsl(${hue}, 70%, 40%)`}
                    strokeWidth={isHovered ? '0.75' : '0.35'}
                    rx="0.25"
                    style={{
                      filter: isHovered ? 'drop-shadow(0 0 3px rgba(37,99,235,0.6))' : undefined,
                    }}
                  />
                  {renderPartLabel(part, isHovered)}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer Summary */}
        <div className="pt-3 mt-3 border-t border-slate-300 dark:border-[#3c4043] flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4">
            <span>
              Total Job Sheets: <strong className="text-slate-800 dark:text-slate-100 font-mono">{nestResult.totalSheets}</strong>
            </span>
            <span>
              With Buffer (+10%): <strong className="text-blue-700 dark:text-blue-400 font-mono">{nestResult.bufferedSheets}</strong>
            </span>
            <span>
              Total Placed Parts: <strong className="text-slate-800 dark:text-slate-100 font-mono">{nestResult.placedPartsCount}</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="neu-btn px-4 py-1.5 font-bold text-slate-700 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
