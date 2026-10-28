import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './Icon';
import { useToast } from './Toast';
import { generateId, detectSubstrateFromName } from '../utils/mtoFormatter';
import { searchLaminates } from '../utils/laminateCatalog';

const DEFAULT_RECENT_MATERIALS = [
  'Wilsonart Sap Walnut 8221-38',
  'Formica White 949',
  'PL-1',
  'Corian Glacier Ice',
  'Standard Backer',
];

export default function MaterialWizard({ onAddItems }) {
  const { showToast } = useToast();

  // Category: 'laid_up' | 'loose' | 'solid_surface'
  const [category, setCategory] = useState('laid_up');

  // Material Name state & Wilsonart autofill suggestions
  const [materialName, setMaterialName] = useState('Wilsonart Sap Walnut 8221-38');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  const [recentMaterials, setRecentMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem('mto_recent_materials');
      return saved ? JSON.parse(saved) : DEFAULT_RECENT_MATERIALS;
    } catch {
      return DEFAULT_RECENT_MATERIALS;
    }
  });

  // Laid Up state
  const [thickness, setThickness] = useState('3/4"');
  const [customThickness, setCustomThickness] = useState('');
  const [isCustomThickness, setIsCustomThickness] = useState(false);
  const [sides, setSides] = useState('2S'); // '2S' | '1S' | 'Raw Core Only'

  // Laid Up Matrix Table State: rows = [4x8, 5x10, 5x12, customSize]
  const [customRowSize, setCustomRowSize] = useState('4x10');
  const [matrixData, setMatrixData] = useState({
    '4x8': { PB: '', MDF: '', PLY: '' },
    '5x10': { PB: '', MDF: '', PLY: '' },
    '5x12': { PB: '', MDF: '', PLY: '' },
    custom: { PB: '', MDF: '', PLY: '' },
  });

  // Loose Sheet state
  const [looseSize, setLooseSize] = useState('4x8');
  const [customLooseSize, setCustomLooseSize] = useState('');
  const [isCustomLooseSize, setIsCustomLooseSize] = useState(false);
  const [looseQty, setLooseQty] = useState(1);

  // Solid Surface state
  const [solidThickness, setSolidThickness] = useState('1/2"');
  const [solidSize, setSolidSize] = useState('30x144');
  const [customSolidSize, setCustomSolidSize] = useState('');
  const [isCustomSolidSize, setIsCustomSolidSize] = useState(false);
  const [solidQty, setSolidQty] = useState(1);

  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Segmented Laminate autofill suggestions (Wilsonart & Formica)
  const searchResult = useMemo(() => {
    if (!materialName || !materialName.trim()) {
      return { wilsonart: [], formica: [], all: [], totalMatches: 0 };
    }
    return searchLaminates(materialName, 8);
  }, [materialName]);

  const allSuggestions = searchResult.all;
  const isExactMatch = allSuggestions.length === 1 && allSuggestions[0].label.toLowerCase() === materialName.trim().toLowerCase();
  const shouldShowDropdown = showSuggestions && allSuggestions.length > 0 && !isExactMatch;

  const handleSelectSuggestion = (label) => {
    setMaterialName(label);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!shouldShowDropdown || allSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % allSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetIdx = highlightedIndex >= 0 ? highlightedIndex : 0;
      if (allSuggestions[targetIdx]) {
        handleSelectSuggestion(allSuggestions[targetIdx].label);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Save recent materials
  const addRecentMaterial = (name) => {
    const clean = name.trim();
    if (!clean) return;
    setRecentMaterials((prev) => {
      const filtered = prev.filter((m) => m.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 8);
      localStorage.setItem('mto_recent_materials', JSON.stringify(updated));
      return updated;
    });
  };

  // Matrix cell update
  const handleMatrixCellChange = (sizeKey, subKey, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setMatrixData((prev) => ({
      ...prev,
      [sizeKey]: {
        ...prev[sizeKey],
        [subKey]: cleanVal,
      },
    }));
  };

  const adjustMatrixCell = (sizeKey, subKey, delta) => {
    const current = parseInt(matrixData[sizeKey]?.[subKey], 10) || 0;
    const nextVal = Math.max(0, current + delta);
    setMatrixData((prev) => ({
      ...prev,
      [sizeKey]: {
        ...prev[sizeKey],
        [subKey]: nextVal === 0 ? '' : String(nextVal),
      },
    }));
  };

  // Add Laid Up Matrix to MTO
  const handleAddMatrixToMto = () => {
    const cleanMatName = materialName.trim();
    if (!cleanMatName) {
      showToast({
        type: 'warning',
        title: 'Material Name Required',
        message: 'Please enter a Material / Laminate Name first.',
      });
      return;
    }

    const effectiveThickness = isCustomThickness ? (customThickness ? `${customThickness}"` : '3/4"') : thickness;
    const effectiveSides = sides === 'Raw Core Only' ? '' : sides;

    const rows = [
      { key: '4x8', size: '4x8' },
      { key: '5x10', size: '5x10' },
      { key: '5x12', size: '5x12' },
      { key: 'custom', size: customRowSize.trim() || 'Custom' },
    ];
    const substrates = ['PB', 'MDF', 'PLY'];

    const newItems = [];

    rows.forEach((r) => {
      substrates.forEach((sub) => {
        const qtyVal = parseInt(matrixData[r.key]?.[sub], 10) || 0;
        if (qtyVal > 0) {
          newItems.push({
            id: generateId(),
            source: 'manual',
            category: 'laid_up',
            qty: qtyVal,
            thickness: effectiveThickness,
            materialName: cleanMatName,
            substrate: sub,
            sheetSize: r.size,
            sides: effectiveSides,
            customOverrideText: null,
          });
        }
      });
    });

    if (newItems.length === 0) {
      showToast({
        type: 'warning',
        title: 'Quantities Required',
        message: 'Please enter quantity for at least one cell in the matrix table.',
      });
      return;
    }

    onAddItems(newItems);
    addRecentMaterial(cleanMatName);

    // Reset matrix counts while retaining material name
    setMatrixData({
      '4x8': { PB: '', MDF: '', PLY: '' },
      '5x10': { PB: '', MDF: '', PLY: '' },
      '5x12': { PB: '', MDF: '', PLY: '' },
      custom: { PB: '', MDF: '', PLY: '' },
    });

    const totalSheets = newItems.reduce((acc, i) => acc + i.qty, 0);
    showToast({
      type: 'success',
      title: 'Added to Takeoff',
      message: `Added ${totalSheets} laid-up sheet${totalSheets === 1 ? '' : 's'} (${cleanMatName}) to MTO document.`,
    });
    setFeedbackMsg(`Added ${totalSheets} laid-up sheets to MTO!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Add Loose Sheet to MTO
  const handleAddLooseToMto = () => {
    const cleanMatName = materialName.trim();
    if (!cleanMatName) {
      showToast({
        type: 'warning',
        title: 'Material Name Required',
        message: 'Please enter a Material / Laminate Name first.',
      });
      return;
    }

    const effectiveSize = isCustomLooseSize ? (customLooseSize.trim() || 'Custom') : looseSize;

    const item = {
      id: generateId(),
      source: 'manual',
      category: 'loose',
      qty: Math.max(1, looseQty),
      thickness: '',
      materialName: cleanMatName,
      substrate: '',
      sheetSize: effectiveSize,
      sides: 'LOOSE SHEET',
      customOverrideText: null,
    };

    onAddItems([item]);
    addRecentMaterial(cleanMatName);

    showToast({
      type: 'success',
      title: 'Added to Takeoff',
      message: `Added ${item.qty} loose sheet${item.qty === 1 ? '' : 's'} (${cleanMatName}) to MTO document.`,
    });
    setFeedbackMsg(`Added ${item.qty} loose sheet(s) of ${cleanMatName} to MTO!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Add Solid Surface to MTO
  const handleAddSolidSurfaceToMto = () => {
    const cleanMatName = materialName.trim();
    if (!cleanMatName) {
      showToast({
        type: 'warning',
        title: 'Material Name Required',
        message: 'Please enter a Material / Solid Surface Name first.',
      });
      return;
    }

    const effectiveSize = isCustomSolidSize ? (customSolidSize.trim() || 'Custom') : solidSize;

    const item = {
      id: generateId(),
      source: 'manual',
      category: 'solid_surface',
      qty: Math.max(1, solidQty),
      thickness: solidThickness,
      materialName: cleanMatName,
      substrate: 'SS',
      sheetSize: effectiveSize,
      sides: '',
      customOverrideText: null,
    };

    onAddItems([item]);
    addRecentMaterial(cleanMatName);

    showToast({
      type: 'success',
      title: 'Added to Takeoff',
      message: `Added ${item.qty} solid surface sheet${item.qty === 1 ? '' : 's'} (${cleanMatName}) to MTO document.`,
    });
    setFeedbackMsg(`Added ${item.qty} solid surface sheet(s) to MTO!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Category Mode Switcher */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-geometric">
            Step 1 — Takeoff Category
          </span>
          {feedbackMsg && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-pulse">
              <Icon name="check_circle" className="text-base text-emerald-600 dark:text-emerald-400" />
              {feedbackMsg}
            </span>
          )}
        </div>
        <div className="neu-well grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setCategory('laid_up')}
            className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              category === 'laid_up'
                ? 'neu-btn-active text-blue-700 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            LAID UP PANELS
          </button>
          <button
            type="button"
            onClick={() => setCategory('loose')}
            className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              category === 'loose'
                ? 'neu-btn-active text-blue-700 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            LOOSE LAMINATE
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory('solid_surface');
              if (materialName === 'Wilsonart Sap Walnut 8221-38') {
                setMaterialName('Corian Glacier Ice');
              }
            }}
            className={`py-2.5 px-3 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              category === 'solid_surface'
                ? 'neu-btn-active text-blue-700 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            SOLID SURFACE
          </button>
        </div>
      </div>

      {/* Step 2: Material / Laminate Name Input & Recents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="wizard-material-name" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-geometric cursor-pointer">
            Step 2 — {category === 'solid_surface' ? 'Solid Surface / Core Name' : 'Laminate / Finish Name'}
          </label>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Search by name or number (e.g. Wilsonart 8221, Formica 949, White, Walnut)</span>
        </div>

        <div className="relative">
          <div className="neu-pressed px-4 py-3 flex items-center gap-3">
            <Icon name="search" className="text-slate-400 dark:text-slate-500 text-lg flex-shrink-0" />
            <input
              id="wizard-material-name"
              name="materialName"
              type="text"
              value={materialName}
              onChange={(e) => {
                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                setMaterialName(e.target.value);
                setShowSuggestions(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                setIsInputFocused(true);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = setTimeout(() => {
                  setIsInputFocused(false);
                  setShowSuggestions(false);
                }, 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Wilsonart Sap Walnut 8221-38, Formica White 949, or custom (PL-1)"
              className="w-full bg-transparent text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              autoComplete="off"
              spellCheck="false"
            />
            {materialName && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                  setMaterialName('');
                  setShowSuggestions(false);
                  setHighlightedIndex(-1);
                  document.getElementById('wizard-material-name')?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition-colors"
                title="Clear input"
              >
                <Icon name="close" className="text-base" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown Popup */}
          {shouldShowDropdown && (
            <div
              id="wilsonart-suggestions-dropdown"
              ref={dropdownRef}
              style={{ backgroundColor: 'var(--bg-neu)' }}
              className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="px-3.5 py-2 border-b border-slate-300/80 dark:border-slate-700/80 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-black/5 dark:bg-white/5">
                <span className="flex items-center gap-1.5">
                  <Icon name="tune" className="text-xs text-blue-600 dark:text-blue-400" />
                  Standards Catalog ({searchResult.totalMatches} match{searchResult.totalMatches === 1 ? '' : 'es'})
                </span>
                <span className="text-slate-400 font-normal lowercase tracking-normal">
                  ↑↓ navigate • ↵ or click to autofill
                </span>
              </div>

              <div
                onMouseLeave={() => setHighlightedIndex(-1)}
                className="max-h-72 overflow-y-auto divide-y divide-slate-200/50 dark:divide-slate-700/40"
              >
                {/* Wilsonart Segment */}
                {searchResult.wilsonart.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        Wilsonart Standards ({searchResult.wilsonart.length})
                      </span>
                      <span className="text-slate-400 font-normal lowercase tracking-normal">351 catalog items</span>
                    </div>
                    {searchResult.wilsonart.map((item) => {
                      const isHighlighted = typeof item.globalIndex === 'number' && item.globalIndex >= 0 && item.globalIndex === highlightedIndex;
                      return (
                        <div
                          key={`wilsonart-${item.label}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(item.label);
                          }}
                          onMouseEnter={() => setHighlightedIndex(item.globalIndex)}
                          className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                            isHighlighted
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isHighlighted ? 'bg-blue-600 text-white shadow-sm' : 'neu-card-sm text-slate-500 dark:text-slate-400'
                            }`}>
                              <Icon name="format_paint" className="text-sm" />
                            </div>
                            <div className="min-w-0 truncate">
                              <div className="text-sm truncate">
                                {item.label}
                              </div>
                              <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                Wilsonart Design: <span className="font-medium text-slate-600 dark:text-slate-300">{item.name}</span>
                              </div>
                            </div>
                          </div>
                          <span className="ml-3 text-xs font-mono font-semibold px-2.5 py-1 rounded-md neu-pressed text-slate-700 dark:text-slate-300 whitespace-nowrap flex-shrink-0">
                            #{item.number}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Formica Segment */}
                {searchResult.formica.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        Formica Standards ({searchResult.formica.length})
                      </span>
                      <span className="text-slate-400 font-normal lowercase tracking-normal">343 catalog items</span>
                    </div>
                    {searchResult.formica.map((item) => {
                      const isHighlighted = typeof item.globalIndex === 'number' && item.globalIndex >= 0 && item.globalIndex === highlightedIndex;
                      return (
                        <div
                          key={`formica-${item.label}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(item.label);
                          }}
                          onMouseEnter={() => setHighlightedIndex(item.globalIndex)}
                          className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                            isHighlighted
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isHighlighted ? 'bg-emerald-600 text-white shadow-sm' : 'neu-card-sm text-slate-500 dark:text-slate-400'
                            }`}>
                              <Icon name="palette" className="text-sm" />
                            </div>
                            <div className="min-w-0 truncate">
                              <div className="text-sm truncate">
                                {item.label}
                              </div>
                              <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                Formica Design: <span className="font-medium text-slate-600 dark:text-slate-300">{item.name}</span>
                              </div>
                            </div>
                          </div>
                          <span className="ml-3 text-xs font-mono font-semibold px-2.5 py-1 rounded-md neu-pressed text-slate-700 dark:text-slate-300 whitespace-nowrap flex-shrink-0">
                            #{item.number}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent / Preset Chips Bar */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            Recents:
          </span>
          {recentMaterials.map((mat) => (
            <button
              key={mat}
              type="button"
              onClick={() => {
                setMaterialName(mat);
                setShowSuggestions(false);
              }}
              className={`neu-btn px-2.5 py-1 text-xs font-medium transition-all ${
                materialName === mat ? 'text-blue-700 dark:text-blue-400 font-bold neu-btn-active' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {mat}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Conditional Spec & Quantity Matrix */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-geometric">
            Step 3 — Specifications & Sheet Quantities
          </span>
        </div>

        {/* ================= CONDITION A: LAID UP PANELS ================= */}
        {category === 'laid_up' && (
          <div className="space-y-4">
            {/* Row of Thickness & Layup Faces */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Thickness Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Finished Thickness
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['1/4"', '1/2"', '3/4"', '1"', '1 1/8"'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setThickness(t);
                        setIsCustomThickness(false);
                      }}
                      className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                        !isCustomThickness && thickness === t
                          ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomThickness(true)}
                    className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                      isCustomThickness ? 'neu-btn-active text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Custom
                  </button>
                  {isCustomThickness && (
                    <input
                      id="wizard-custom-thickness"
                      name="customThickness"
                      aria-label="Custom Core Finished Thickness"
                      type="text"
                      value={customThickness}
                      onChange={(e) => setCustomThickness(e.target.value)}
                      placeholder='e.g. 1 1/8"'
                      className="neu-pressed px-2.5 py-1 text-xs font-semibold w-24 text-slate-700 dark:text-slate-100 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Layup Faces Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Layup Faces (Sides)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: '2S', label: '2S (Good 2 Sides)' },
                    { id: '1S', label: '1S (Face + Backer)' },
                    { id: 'Raw Core Only', label: 'Raw Core Only' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSides(s.id)}
                      className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                        sides === s.id ? 'neu-btn-active text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* The Flowchart Material Matrix Table (PB / MDF / PLY / HPL) */}
            <div className="neu-card-sm p-3.5 bg-neu-base/60 border border-slate-300/40 dark:border-slate-700/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-geometric">
                  MATERIAL MATRIX (SHEET QUANTITIES)
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Enter sheet counts directly in matrix cells
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 font-geometric">
                      <th className="py-2 px-3 w-28">SIZE</th>
                      <th className="py-2 px-3 text-center">PB (Particle)</th>
                      <th className="py-2 px-3 text-center">MDF</th>
                      <th className="py-2 px-3 text-center">PLY (Plywood)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {[
                      { key: '4x8', label: '4x8' },
                      { key: '5x10', label: '5x10' },
                      { key: '5x12', label: '5x12' },
                    ].map((row) => (
                      <tr key={row.key} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {row.label}
                        </td>
                        {['PB', 'MDF', 'PLY'].map((sub) => (
                          <td key={sub} className="py-2 px-2 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => adjustMatrixCell(row.key, sub, -1)}
                                className="w-5 h-5 rounded neu-btn flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                title="Decrease"
                              >
                                <Icon name="remove" className="text-[12px]" />
                              </button>
                              <input
                                id={`matrix-qty-${row.key}-${sub.toLowerCase()}`}
                                name={`matrix_qty_${row.key}_${sub.toLowerCase()}`}
                                aria-label={`${row.size} ${sub} Quantity`}
                                type="text"
                                inputMode="numeric"
                                value={matrixData[row.key][sub]}
                                onChange={(e) => handleMatrixCellChange(row.key, sub, e.target.value)}
                                placeholder="0"
                                className="neu-pressed w-12 text-center py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => adjustMatrixCell(row.key, sub, 1)}
                                className="w-5 h-5 rounded neu-btn flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                title="Increase"
                              >
                                <Icon name="add" className="text-[12px]" />
                              </button>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Custom 4th Row */}
                    <tr className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-2">
                        <input
                          id="matrix-custom-row-size"
                          name="customRowSize"
                          aria-label="Custom Sheet Size"
                          type="text"
                          value={customRowSize}
                          onChange={(e) => setCustomRowSize(e.target.value)}
                          placeholder="4x10"
                          className="neu-pressed px-2 py-1 text-xs font-bold font-mono w-20 text-slate-700 dark:text-slate-200 focus:outline-none"
                          title="Custom Sheet Size"
                        />
                      </td>
                      {['PB', 'MDF', 'PLY'].map((sub) => (
                        <td key={sub} className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustMatrixCell('custom', sub, -1)}
                              className="w-5 h-5 rounded neu-btn flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              title="Decrease"
                            >
                              <Icon name="remove" className="text-[12px]" />
                            </button>
                            <input
                              id={`matrix-qty-custom-${sub.toLowerCase()}`}
                              name={`matrix_qty_custom_${sub.toLowerCase()}`}
                              aria-label={`Custom Sheet ${sub} Quantity`}
                              type="text"
                              inputMode="numeric"
                              value={matrixData.custom[sub]}
                              onChange={(e) => handleMatrixCellChange('custom', sub, e.target.value)}
                              placeholder="0"
                              className="neu-pressed w-12 text-center py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => adjustMatrixCell('custom', sub, 1)}
                              className="w-5 h-5 rounded neu-btn flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              title="Increase"
                            >
                              <Icon name="add" className="text-[12px]" />
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Button */}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddMatrixToMto}
                  className="neu-btn-primary px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  <Icon name="playlist_add" className="text-lg" />
                  <span>Add to MTO</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONDITION B: LOOSE LAMINATE ================= */}
        {category === 'loose' && (
          <div className="neu-card-sm p-4 space-y-4">
            {/* Laminate Sheet Size Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Laminate Sheet Size
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {['4x8', '5x10', '5x12'].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setLooseSize(sz);
                      setIsCustomLooseSize(false);
                    }}
                    className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                      !isCustomLooseSize && looseSize === sz
                        ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomLooseSize(true)}
                  className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                    isCustomLooseSize ? 'neu-btn-active text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Custom
                </button>
                {isCustomLooseSize && (
                  <input
                    id="wizard-custom-loose-size"
                    name="customLooseSize"
                    aria-label="Custom Loose Laminate Sheet Size"
                    type="text"
                    value={customLooseSize}
                    onChange={(e) => setCustomLooseSize(e.target.value)}
                    placeholder="e.g. 4x10"
                    className="neu-pressed px-2.5 py-1 text-xs font-semibold w-24 text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                )}
              </div>
            </div>

            {/* Stepper + Submit */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <label htmlFor="wizard-loose-qty" className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                  Quantity:
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLooseQty((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg neu-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
                    title="Decrease quantity"
                  >
                    <Icon name="remove" className="text-base" />
                  </button>
                  <input
                    id="wizard-loose-qty"
                    name="looseQty"
                    aria-label="Loose Laminate Quantity"
                    type="text"
                    inputMode="numeric"
                    value={looseQty}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setLooseQty(isNaN(num) ? 1 : Math.max(1, num));
                    }}
                    className="neu-pressed w-16 text-center py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setLooseQty((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg neu-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
                    title="Increase quantity"
                  >
                    <Icon name="add" className="text-base" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddLooseToMto}
                className="neu-btn-primary px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <Icon name="playlist_add" className="text-lg" />
                <span>Add Loose Sheet to MTO</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= CONDITION C: SOLID SURFACE / OTHER ================= */}
        {category === 'solid_surface' && (
          <div className="neu-card-sm p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Thickness Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Solid Surface Thickness
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['1/4"', '1/2"', '3/4"'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSolidThickness(t)}
                      className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                        solidThickness === t ? 'neu-btn-active text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sheet Size Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Standard Slab / Sheet Size
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['30x144', '36x144', '4x8'].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setSolidSize(sz);
                        setIsCustomSolidSize(false);
                      }}
                      className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                        !isCustomSolidSize && solidSize === sz
                          ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomSolidSize(true)}
                    className={`neu-btn px-3 py-1.5 text-xs font-semibold ${
                      isCustomSolidSize ? 'neu-btn-active text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Custom
                  </button>
                  {isCustomSolidSize && (
                    <input
                      id="wizard-custom-solid-size"
                      name="customSolidSize"
                      aria-label="Custom Solid Surface Sheet Size"
                      type="text"
                      value={customSolidSize}
                      onChange={(e) => setCustomSolidSize(e.target.value)}
                      placeholder="e.g. 30x96"
                      className="neu-pressed px-2.5 py-1 text-xs font-semibold w-24 text-slate-700 dark:text-slate-200 focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Stepper + Submit */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <label htmlFor="wizard-solid-qty" className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                  Quantity:
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSolidQty((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg neu-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
                    title="Decrease quantity"
                  >
                    <Icon name="remove" className="text-base" />
                  </button>
                  <input
                    id="wizard-solid-qty"
                    name="solidQty"
                    aria-label="Solid Surface Quantity"
                    type="text"
                    inputMode="numeric"
                    value={solidQty}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setSolidQty(isNaN(num) ? 1 : Math.max(1, num));
                    }}
                    className="neu-pressed w-16 text-center py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSolidQty((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg neu-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
                    title="Increase quantity"
                  >
                    <Icon name="add" className="text-base" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSolidSurfaceToMto}
                className="neu-btn-primary px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <Icon name="playlist_add" className="text-lg" />
                <span>Add Item to MTO</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
