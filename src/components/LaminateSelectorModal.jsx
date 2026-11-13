import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './Icon';
import { searchLaminates } from '../utils/laminateCatalog';
import { detectSubstrateFromName } from '../utils/mtoFormatter';

/**
 * Extract decimal caliper from string, e.g. "3/4 2S HPL (0.81250)" -> "(0.81250)"
 */
function extractCaliperTag(str = '') {
  const match = String(str).match(/\(0\.\d+\)/);
  return match ? match[0] : '';
}

/**
 * Format brand prefix according to shop style (e.g. "WA" vs "Wilsonart")
 */
function formatBrandName(label = '', brandStyle = 'WA') {
  if (!label) return '';
  if (brandStyle === 'WA') {
    return label.replace(/^Wilsonart\s+/i, 'WA ');
  }
  return label.replace(/^WA\s+/i, 'Wilsonart ');
}

/**
 * Single Laminate Search Autocomplete Input
 */
function LaminateSearchInput({
  id,
  label,
  value,
  onChange,
  onSelect,
  placeholder = 'Search Wilsonart or Formica (e.g. Kensington Maple, 10776, Folkstone)...',
  disabled = false,
}) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Sync external value
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResult = useMemo(() => {
    if (!query || !query.trim() || disabled) {
      return { wilsonart: [], formica: [], all: [], totalMatches: 0 };
    }
    return searchLaminates(query, 8);
  }, [query, disabled]);

  const allSuggestions = searchResult.all;
  const isExactMatch =
    allSuggestions.length === 1 &&
    allSuggestions[0].label.toLowerCase() === query.trim().toLowerCase();
  const showDropdown = isOpen && allSuggestions.length > 0 && !isExactMatch && !disabled;

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handlePick = (itemLabel) => {
    setQuery(itemLabel);
    onChange(itemLabel);
    onSelect(itemLabel);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || allSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % allSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      const target = highlightedIndex >= 0 ? allSuggestions[highlightedIndex] : allSuggestions[0];
      if (target) {
        handlePick(target.label);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Icon name="search" className="text-base" />
        </div>
        <input
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled && query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all focus:outline-none ${
            disabled
              ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700 cursor-not-allowed'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner'
          }`}
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onChange('');
              onSelect('');
            }}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <Icon name="close" className="text-sm" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Wilsonart Segment */}
          {searchResult.wilsonart.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 px-3 py-1 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Wilsonart Standards ({searchResult.wilsonart.length})
                </span>
                <span className="text-slate-400 font-normal">Catalog</span>
              </div>
              {searchResult.wilsonart.map((item) => {
                const isSelected = item.globalIndex === highlightedIndex;
                return (
                  <div
                    key={`wa-${item.label}`}
                    data-laminate-item={item.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(item.label);
                    }}
                    onClick={() => handlePick(item.label)}
                    onMouseEnter={() => setHighlightedIndex(item.globalIndex)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                      <span className="text-slate-400 ml-1.5 font-mono text-[11px]">#{item.number}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                      Wilsonart
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formica Segment */}
          {searchResult.formica.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 px-3 py-1 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Formica Standards ({searchResult.formica.length})
                </span>
                <span className="text-slate-400 font-normal">Catalog</span>
              </div>
              {searchResult.formica.map((item) => {
                const isSelected = item.globalIndex === highlightedIndex;
                return (
                  <div
                    key={`formica-${item.label}`}
                    data-laminate-item={item.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(item.label);
                    }}
                    onClick={() => handlePick(item.label)}
                    onMouseEnter={() => setHighlightedIndex(item.globalIndex)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                      <span className="text-slate-400 ml-1.5 font-mono text-[11px]">#{item.number}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      Formica
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * LaminateSelectorModal
 *
 * Pop-up modal capable of searching the Wilsonart and Formica laminate catalog,
 * configuring face and back laminates, handling "Same on both sides" checkbox for 2S,
 * and generating the standardized MTO document line description.
 */
export default function LaminateSelectorModal({
  isOpen,
  onClose,
  initialData = {},
  onSave,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="laminate-modal-title"
      onCancel={(e) => {
        if (e.target !== dialogRef.current) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto p-0 bg-transparent border-0 max-w-2xl w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] backdrop:bg-black/70 backdrop:backdrop-blur-sm no-print"
    >
      {isOpen && (
        <LaminateSelectorModalContent
          onClose={onClose}
          initialData={initialData}
          onSave={onSave}
        />
      )}
    </dialog>
  );
}

function LaminateSelectorModalContent({
  onClose,
  initialData = {},
  onSave,
}) {

  const rawTag = initialData.materialTag || initialData.materialName || 'Material';
  const autoCaliper = extractCaliperTag(rawTag);

  // Determine initial category
  const initialCategory = useMemo(() => {
    if (initialData.category) return initialData.category;
    const lower = rawTag.toLowerCase();
    if (lower.includes('solid surface') || lower.includes('corian')) return 'solid_surface';
    if (lower.includes('loose')) return 'loose';
    if (lower.includes('1s') || lower.includes('mcp') || lower.includes('wmcp')) return 'laid_up_1s';
    return 'laid_up_2s';
  }, [initialData.category, rawTag]);

  // State
  const [category, setCategory] = useState(initialCategory);
  const [thickness, setThickness] = useState(initialData.thickness || '3/4"');
  const [substrate, setSubstrate] = useState(initialData.substrate || detectSubstrateFromName(rawTag) || 'PB');
  const [sheetSize, setSheetSize] = useState(initialData.sheetSize || '5x10');
  const [caliperTag, setCaliperTag] = useState(autoCaliper);
  const [includeCaliper, setIncludeCaliper] = useState(Boolean(autoCaliper));
  const [brandStyle, setBrandStyle] = useState('WA'); // 'WA' | 'Wilsonart'

  // Face & Back Laminate
  const [faceLaminate, setFaceLaminate] = useState(initialData.faceLaminate || '');
  const [backLaminate, setBackLaminate] = useState(
    initialData.backLaminate || initialData.faceLaminate || ''
  );
  const [sameOnBothSides, setSameOnBothSides] = useState(
    initialData.sameOnBothSides !== undefined ? initialData.sameOnBothSides : true
  );
  const [backerType, setBackerType] = useState(
    initialData.backerType || (rawTag.toUpperCase().includes('MCP') ? 'WMCP' : 'Standard Backer')
  );

  // Editable preview
  const [customText, setCustomText] = useState(initialData.customOverrideText || '');
  const [isManualEdit, setIsManualEdit] = useState(Boolean(initialData.customOverrideText));

  // Auto-generate description preview
  const autoGeneratedDescription = useMemo(() => {
    const formattedFace = formatBrandName(faceLaminate, brandStyle);
    const formattedBack = formatBrandName(backLaminate, brandStyle);
    const caliperStr = includeCaliper && caliperTag ? ` ${caliperTag}` : '';

    if (category === 'laid_up_2s' || category === 'laid_up') {
      if (sameOnBothSides || !formattedBack || formattedBack === formattedFace) {
        // e.g. 3/4" 2S WA Kensington Maple (0.81250) (5x10) 2S
        const namePart = formattedFace ? `2S ${formattedFace}` : rawTag;
        return `${thickness} ${namePart}${caliperStr} (${sheetSize}) 2S`.trim();
      } else {
        // e.g. 3/4" WA Kensington Maple / WA Designer White - PB (0.81250) (5x10) 2S
        return `${thickness} ${formattedFace} / ${formattedBack} - ${substrate}${caliperStr} (${sheetSize}) 2S`.trim();
      }
    }

    if (category === 'laid_up_1s') {
      // e.g. 3/4" WA Kensington Maple - WMCP (0.78125) (5x10) 1S
      const namePart = formattedFace || rawTag;
      const backerPart = backerType ? ` - ${backerType}` : (substrate ? ` - ${substrate}` : '');
      return `${thickness} ${namePart}${backerPart}${caliperStr} (${sheetSize}) 1S`.trim();
    }

    if (category === 'loose') {
      const namePart = formattedFace || rawTag;
      return `${namePart} (${sheetSize}) LOOSE SHEET`.trim();
    }

    if (category === 'solid_surface') {
      const namePart = formattedFace || rawTag;
      return `${thickness} ${namePart} (${sheetSize})`.trim();
    }

    return `${thickness} ${formattedFace || rawTag} (${sheetSize}) 2S`.trim();
  }, [
    category,
    thickness,
    substrate,
    sheetSize,
    caliperTag,
    includeCaliper,
    brandStyle,
    faceLaminate,
    backLaminate,
    sameOnBothSides,
    backerType,
    rawTag,
  ]);

  // Keep preview text synced unless user manually edited it
  useEffect(() => {
    if (!isManualEdit) {
      setCustomText(autoGeneratedDescription);
    }
  }, [autoGeneratedDescription, isManualEdit]);

  // When Face laminate changes and "sameOnBothSides" is true, sync Back
  const handleFaceSelect = (label) => {
    setFaceLaminate(label);
    if (sameOnBothSides) {
      setBackLaminate(label);
    }
  };

  // Handle Save
  const handleApply = () => {
    const finalFace = faceLaminate.trim();
    const finalBack = sameOnBothSides ? finalFace : backLaminate.trim();

    onSave({
      category,
      thickness,
      substrate,
      sheetSize,
      faceLaminate: finalFace,
      backLaminate: finalBack,
      sameOnBothSides,
      backerType,
      customOverrideText: isManualEdit ? customText.trim() : autoGeneratedDescription,
      brandStyle,
    });
    onClose();
  };

  // Reset to default
  const handleResetToDefault = () => {
    setFaceLaminate('');
    setBackLaminate('');
    setSameOnBothSides(true);
    setIsManualEdit(false);
    setCustomText('');
  };

  return (
    <div className="bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-2xl p-4 sm:p-6 max-w-2xl w-full border border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Icon name="palette" className="text-xl text-white" />
            </div>
            <div className="min-w-0">
              <h3 id="laminate-modal-title" className="text-base font-bold text-slate-800 dark:text-slate-100 font-geometric truncate">
                Assign Laminate to Material
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Original Tag: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{rawTag}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* 1. Category / Construction Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[10px]">
              Panel Construction Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'laid_up_2s', label: '2S Laid Up (HPL / HPL)' },
                { id: 'laid_up_1s', label: '1S Laid Up (HPL / Melamine)' },
                { id: 'loose', label: 'Loose Laminate' },
                { id: 'solid_surface', label: 'Solid Surface' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center border ${
                    category === c.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Side 1: Face Laminate Search */}
          <div className="bg-white dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Side 1: Face Laminate (Exterior / Primary)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Brand Style:</span>
                <button
                  type="button"
                  onClick={() => setBrandStyle('WA')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    brandStyle === 'WA'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  WA
                </button>
                <button
                  type="button"
                  onClick={() => setBrandStyle('Wilsonart')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    brandStyle === 'Wilsonart'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Wilsonart
                </button>
              </div>
            </div>

            <LaminateSearchInput
              id="face-laminate-search"
              value={faceLaminate}
              onChange={(val) => {
                setFaceLaminate(val);
                if (sameOnBothSides) setBackLaminate(val);
              }}
              onSelect={handleFaceSelect}
              placeholder="Type to search Wilsonart or Formica (e.g. Kensington Maple, 10776)..."
            />
          </div>

          {/* 3. Side 2: Back Laminate / Finish (Conditional) */}
          {(category === 'laid_up_2s' || category === 'laid_up') && (
            <div className="bg-white dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Side 2: Back Laminate (Interior / Secondary)
                  </span>
                </div>

                {/* SAME ON BOTH SIDES CHECKBOX */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="same-on-both-sides-toggle"
                    checked={sameOnBothSides}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameOnBothSides(checked);
                      if (checked) {
                        setBackLaminate(faceLaminate);
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Same on both sides
                  </span>
                </label>
              </div>

              {sameOnBothSides ? (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Icon name="link" className="text-blue-600 dark:text-blue-400 text-base" />
                  <span>
                    Back face automatically matches Side 1:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {faceLaminate || 'Same as Face'}
                    </strong>
                  </span>
                </div>
              ) : (
                <div className="animate-fade-in space-y-2">
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Different laminate on back face — order breakdown will split face &amp; back sheets:
                  </p>
                  <LaminateSearchInput
                    id="back-laminate-search"
                    value={backLaminate}
                    onChange={setBackLaminate}
                    onSelect={(val) => setBackLaminate(val)}
                    placeholder="Search different back laminate (e.g. Designer White D354, Folkstone 927)..."
                  />
                </div>
              )}
            </div>
          )}

          {/* 3b. Backer for 1S Materials */}
          {category === 'laid_up_1s' && (
            <div className="bg-white dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                Side 2: Backer / Core Finish
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'WMCP', label: 'WMCP (White Melamine)' },
                  { id: 'BMCP', label: 'BMCP (Black Melamine)' },
                  { id: 'Standard Backer', label: 'Standard Backer (.020)' },
                  { id: 'Raw Core', label: 'Raw Core (Unfinished)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBackerType(b.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                      backerType === b.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Substrate, Sheet Size & Caliper */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Substrate */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Substrate Core
              </label>
              <select
                id="laminate-modal-substrate"
                value={substrate}
                onChange={(e) => setSubstrate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="PB">PB (Particleboard)</option>
                <option value="MDF">MDF</option>
                <option value="PLY">PLY (Plywood)</option>
                <option value="WMCP">WMCP (White Melamine)</option>
                <option value="BMCP">BMCP (Black Melamine)</option>
                <option value="MCP">MCP (Melamine Coated)</option>
              </select>
            </div>

            {/* Sheet Size */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Sheet Size
              </label>
              <select
                id="laminate-modal-sheet-size"
                value={sheetSize}
                onChange={(e) => setSheetSize(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="4x8">4x8 (48" × 96")</option>
                <option value="5x10">5x10 (60" × 120")</option>
                <option value="5x12">5x12 (60" × 144")</option>
                <option value="61x109">61x109 (61" × 109" MCP)</option>
                <option value="30x144">30x144 (Solid Surface)</option>
              </select>
            </div>

            {/* Caliper decimal tag */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Caliper Tag
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={includeCaliper}
                    onChange={(e) => setIncludeCaliper(e.target.checked)}
                    className="rounded text-blue-600 h-3 w-3"
                  />
                  <span>Include</span>
                </label>
              </div>
              <input
                type="text"
                value={caliperTag}
                disabled={!includeCaliper}
                onChange={(e) => setCaliperTag(e.target.value)}
                placeholder="(0.81250)"
                className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* 5. Live Formatted MTO Description Preview */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live MTO Line Description Preview
              </span>
              {isManualEdit && (
                <button
                  type="button"
                  onClick={() => setIsManualEdit(false)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Reset to Auto Formula
                </button>
              )}
            </div>
            <input
              type="text"
              id="laminate-modal-preview-text"
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setIsManualEdit(true);
              }}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-blue-400/80 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none shadow-sm"
              title="Click to tweak formatted text if needed"
            />
            <p className="text-[10px] text-slate-400 italic">
              This exact line text will appear on the final MTO takeoff document.
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Clear / Revert to PNC
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="apply-laminate-btn"
              onClick={handleApply}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5 transition-all"
            >
              <Icon name="check" className="text-sm text-white" />
              <span>Apply Laminate</span>
            </button>
          </div>
        </div>
      </div>
  );
}
