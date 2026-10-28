import React, { useState, useEffect, useMemo } from 'react';
import Icon from './Icon';
import {
  parseCabinetVisionExport,
  nestPartsLocal,
  nestPartsSmartcut,
  SAMPLE_CV_CUTLIST,
} from '../utils/nestingEngine';
import { parsePncBinary } from '../utils/pncParser';
import { getFutrusPncUint8Array } from '../utils/pncDemoData';
import {
  generateId,
  detectSubstrateFromName,
  parseThicknessFromName,
  formatThicknessFraction,
} from '../utils/mtoFormatter';
import SvgNestModal from './SvgNestModal';
import { useToast } from './Toast';

export default function CutlistImporter({ onAddItems, detectedFiles, jobData, setJobData }) {
  const { showToast } = useToast();
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [loadedPnc, setLoadedPnc] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  // Global Nesting Options
  const [stockSheetSize, setStockSheetSize] = useState('4x8');
  const [kerf, setKerf] = useState(0.25);
  const [edgeTrim, setEdgeTrim] = useState(0.5);
  const [wastePercent, setWastePercent] = useState(10);
  const [bufferMode, setBufferMode] = useState('area'); // 'area' | 'flat' | 'net'
  const [isRenesting, setIsRenesting] = useState(false);
  const [nestTrigger, setNestTrigger] = useState(0);

  // Smartcut.dev API state
  const [showSmartcutConfig, setShowSmartcutConfig] = useState(false);
  const [useSmartcut, setUseSmartcut] = useState(false);
  const [smartcutApiKey, setSmartcutApiKey] = useState(() => {
    return localStorage.getItem('mto_smartcut_api_key') || '';
  });

  // Material Group Configuration States:
  // Keyed by material group name: { selected, sheetSize, category, substrate, thickness, nestResult }
  const [groupConfigs, setGroupConfigs] = useState({});

  // Active Nest Preview Modal State
  const [previewNest, setPreviewNest] = useState(null);

  // Trigger explicit re-nest calculation with visual feedback
  const handleRenest = () => {
    setIsRenesting(true);
    setTimeout(() => {
      setNestTrigger((c) => c + 1);
      setIsRenesting(false);
      const grpCount = parseResult?.materialGroups?.length || 0;
      showToast({
        type: 'success',
        title: 'Re-Nesting Complete',
        message: `Recalculated nests across ${grpCount} material group${grpCount === 1 ? '' : 's'} (${
          bufferMode === 'area' ? 'Smart Area Buffer' : bufferMode === 'net' ? 'Net Sheets' : 'Flat Buffer'
        }).`,
      });
    }, 280);
  };

  // Change default sheet size and dynamically update groups
  const handleStockSheetSizeChange = (newSize) => {
    setStockSheetSize(newSize);
    setIsRenesting(true);
    setGroupConfigs((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((mat) => {
        if (updated[mat].category !== 'solid_surface' || newSize === '30x144') {
          updated[mat] = { ...updated[mat], sheetSize: newSize };
        }
      });
      return updated;
    });
    setTimeout(() => {
      setNestTrigger((c) => c + 1);
      setIsRenesting(false);
    }, 250);
  };

  // Apply default sheet size to all groups with confirmation
  const handleApplySheetSizeToAll = () => {
    handleStockSheetSizeChange(stockSheetSize);
    showToast({
      type: 'info',
      title: 'Sheet Size Applied',
      message: `Applied ${stockSheetSize} to all applicable material groups.`,
    });
  };

  // Setup group configs from parsed result
  const applyParsedResult = (res, pncMeta = null) => {
    setParseResult(res);
    setLoadedPnc(pncMeta);
    setExpandedGroup(null);

    if (res.success && res.materialGroups) {
      const initialConfigs = {};
      res.materialGroups.forEach((grp) => {
        const mat = grp.material;
        const detectedSub = detectSubstrateFromName(mat);
        const parsedThickDec = parseThicknessFromName(mat) || grp.thickness;
        const thickStr = formatThicknessFraction(parsedThickDec);

        let initialCategory = 'laid_up_2s';
        const lowerMat = mat.toLowerCase();
        if (
          detectedSub === 'SOLID SURFACE' ||
          lowerMat.includes('solid surface') ||
          lowerMat.includes('corian')
        ) {
          initialCategory = 'solid_surface';
        } else if (lowerMat.includes('loose')) {
          initialCategory = 'loose';
        } else if (lowerMat.includes('1s')) {
          initialCategory = 'laid_up_1s';
        }

        // Use sheet size specified in PNC (e.g. 30x144 for solid surface, 4x8 for HPL)
        const autoSheetSize = grp.defaultSheetSize || stockSheetSize;

        initialConfigs[mat] = {
          selected: true,
          sheetSize: autoSheetSize,
          category: initialCategory,
          substrate: detectedSub === 'SOLID SURFACE' ? 'PB' : detectedSub,
          thickness: thickStr,
        };
      });
      setGroupConfigs(initialConfigs);
    }
  };

  // Parse cutlist text whenever rawText changes
  useEffect(() => {
    if (!rawText.trim()) {
      if (!loadedPnc) {
        setParseResult(null);
        setGroupConfigs({});
      }
      return;
    }

    const res = parseCabinetVisionExport(rawText);
    applyParsedResult(res, null);
  }, [rawText]);

  // Dimensions lookup for stock sheet sizes
  const getSheetDimensions = (sizeStr) => {
    switch (sizeStr) {
      case '5x10':
        return { width: 60, length: 120 };
      case '5x12':
        return { width: 60, length: 144 };
      case '30x144':
        return { width: 30, length: 144 };
      case '4x8':
      default:
        return { width: 48, length: 96 };
    }
  };

  // Re-calculate nest results for each material group whenever group settings or parts change
  const groupNestCalculations = useMemo(() => {
    if (!parseResult || !parseResult.materialGroups) return {};

    const calculations = {};
    parseResult.materialGroups.forEach((grp) => {
      const cfg = groupConfigs[grp.material] || {};
      const targetSize = cfg.sheetSize || grp.defaultSheetSize || stockSheetSize;
      const stockSheet = getSheetDimensions(targetSize);

      const nestRes = nestPartsLocal(grp.parts, stockSheet, {
        kerf,
        edgeTrim,
        wastePercent,
        bufferMode,
      });
      calculations[grp.material] = nestRes;
    });

    return calculations;
  }, [parseResult, groupConfigs, stockSheetSize, kerf, edgeTrim, wastePercent, bufferMode, nestTrigger]);

  // Load sample cutlist (CSV)
  const handleLoadSample = () => {
    setLoadedPnc(null);
    setRawText(SAMPLE_CV_CUTLIST);
  };

  // Load Futrus - Two Kings (.PNC) Demo
  const handleLoadFutrusPnc = () => {
    try {
      const bytes = getFutrusPncUint8Array();
      const res = parsePncBinary(bytes);
      if (res.success) {
        setRawText('');
        applyParsedResult(res, {
          fileName: 'Futrus - Two Kings.pnc',
          jobInfo: res.jobInfo,
          assemblies: res.assemblies || [],
          materials: res.materials || [],
        });
        showToast({
          type: 'info',
          title: 'PNC Database Loaded',
          message: 'Futrus - Two Kings.pnc loaded (30 parts across 3 assemblies).',
        });
      } else {
        showToast({
          type: 'error',
          title: 'PNC Parse Error',
          message: res.error || 'Failed to parse Futrus - Two Kings.pnc',
        });
      }
    } catch (err) {
      console.error('Error loading Futrus PNC demo:', err);
      showToast({
        type: 'error',
        title: 'PNC Demo Error',
        message: 'Error loading Futrus PNC demo: ' + err.message,
      });
    }
  };

  // Process any uploaded or selected file (.pnc or text)
  const handleProcessFile = async (file) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.pnc')) {
      try {
        const ab = await file.arrayBuffer();
        const res = parsePncBinary(ab);
        if (res.success) {
          setRawText('');
          applyParsedResult(res, {
            fileName: file.name,
            jobInfo: res.jobInfo,
            assemblies: res.assemblies || [],
            materials: res.materials || [],
          });
          showToast({
            type: 'info',
            title: 'PNC File Loaded',
            message: `${file.name}: ${res.parts.length} parts across ${res.materialGroups.length} material groups.`,
          });
        } else {
          showToast({
            type: 'error',
            title: 'PNC Parse Error',
            message: res.error || 'Invalid .PNC database file.',
          });
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'File Read Error',
          message: `Failed to read .PNC binary file: ${err.message}`,
        });
      }
    } else {
      // Text formats (.csv, .txt, .tsv, .xml)
      const text = await file.text();
      setLoadedPnc(null);
      setRawText(text);
      showToast({
        type: 'info',
        title: 'Cutlist Loaded',
        message: `Loaded text cutlist from ${file.name}.`,
      });
    }
  };

  // Paste clipboard data
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLoadedPnc(null);
        setRawText(text);
        showToast({
          type: 'info',
          title: 'Clipboard Pasted',
          message: 'Pasted cutlist data from clipboard.',
        });
      }
    } catch (err) {
      showToast({
        type: 'warning',
        title: 'Clipboard Access',
        message: 'Unable to read from clipboard. Please paste into the text box directly.',
      });
    }
  };

  // Drag & drop file handler
  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
  };

  // Load file from linked folder
  const handleLoadDetectedFile = async (cvFile) => {
    try {
      let file;
      if (cvFile.handle && typeof cvFile.handle.getFile === 'function') {
        file = await cvFile.handle.getFile();
      } else {
        file = cvFile;
      }
      await handleProcessFile(file);
    } catch (err) {
      console.error('Error reading detected CV file:', err);
    }
  };

  // Sync Job Metadata from PNC to Project Header
  const handleSyncJobMeta = () => {
    if (!loadedPnc?.jobInfo || !setJobData) return;
    const { jobName, jobNumber, client } = loadedPnc.jobInfo;
    setJobData((prev) => ({
      ...prev,
      jobName: jobName || prev.jobName,
      jobNumber: jobNumber || prev.jobNumber,
      client: client || prev.client || '',
    }));
    showToast({
      type: 'success',
      title: 'Project Header Synced',
      message: `Job: ${jobName || '—'}  |  Job #: ${jobNumber || '—'}\nClient: ${client || '—'}`,
    });
  };

  // Toggle selection for group
  const handleToggleSelectGroup = (mat) => {
    setGroupConfigs((prev) => ({
      ...prev,
      [mat]: {
        ...prev[mat],
        selected: !prev[mat]?.selected,
      },
    }));
  };

  // Update specific group config
  const handleUpdateGroupConfig = (mat, field, value) => {
    setGroupConfigs((prev) => ({
      ...prev,
      [mat]: {
        ...prev[mat],
        [field]: value,
      },
    }));
  };

  // Unlock Grain for a part in a material group and re-nest
  const handleUnlockGrainAndRenest = (part, materialName) => {
    if (!parseResult) return;
    const targetMat = materialName || previewNest?.material || part?.material;
    const targetPartId = part?.originalPartId || part?.id;

    let unlockedName = '';

    // Update parseResult parts
    setParseResult((prev) => {
      if (!prev) return prev;
      const updatedParts = prev.parts.map((p) => {
        const isMatch =
          p.id === targetPartId ||
          (part && p.partName === part.partName && p.assemblyNumber === part.assemblyNumber && p.material === targetMat);
        if (isMatch) {
          unlockedName = p.partName || p.name;
          return { ...p, grainLocked: false };
        }
        return p;
      });

      const updatedGroups = (prev.materialGroups || []).map((grp) => {
        if (grp.material !== targetMat) return grp;
        const groupParts = grp.parts.map((p) => {
          const isMatch =
            p.id === targetPartId ||
            (part && p.partName === part.partName && p.assemblyNumber === part.assemblyNumber);
          if (isMatch) {
            unlockedName = p.partName || p.name;
            return { ...p, grainLocked: false };
          }
          return p;
        });
        return { ...grp, parts: groupParts };
      });

      return {
        ...prev,
        parts: updatedParts,
        materialGroups: updatedGroups,
      };
    });

    // Bump nestTrigger to re-calculate nest immediately
    setNestTrigger((c) => c + 1);

    showToast({
      type: 'success',
      title: 'Grain Unlocked & Re-Nested',
      message: `${unlockedName || 'Part'} grain direction unlocked for rotation on ${targetMat}.`,
    });
  };

  // Push Selected Groups to Right Panel MTO
  const handlePushSelectedToMto = () => {
    if (!parseResult || !parseResult.materialGroups) return;

    const itemsToAdd = [];

    parseResult.materialGroups.forEach((grp) => {
      const cfg = groupConfigs[grp.material];
      if (!cfg || !cfg.selected) return;

      const nestRes = groupNestCalculations[grp.material];
      const sheetQty = nestRes?.bufferedSheets || 1;
      const targetSize = cfg.sheetSize || grp.defaultSheetSize || stockSheetSize;

      let category = 'laid_up';
      let sides = '2S';
      let substrate = cfg.substrate || 'PB';

      if (cfg.category === 'laid_up_2s') {
        category = 'laid_up';
        sides = '2S';
      } else if (cfg.category === 'laid_up_1s') {
        category = 'laid_up';
        sides = '1S';
      } else if (cfg.category === 'loose') {
        category = 'loose';
        sides = 'LOOSE SHEET';
        substrate = '';
      } else if (cfg.category === 'solid_surface') {
        category = 'solid_surface';
        sides = '';
        substrate = 'SS';
      }

      itemsToAdd.push({
        id: generateId(),
        source: loadedPnc ? 'cv-pnc' : 'cv-import',
        category,
        qty: sheetQty,
        thickness: category === 'loose' ? '' : (cfg.thickness || '3/4"'),
        materialName: grp.material,
        substrate,
        sheetSize: targetSize,
        sides,
        customOverrideText: null,
      });
    });

    if (itemsToAdd.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Groups Selected',
        message: 'Please check at least one material group to push to the MTO document.',
      });
      return;
    }

    const currentSource = loadedPnc ? 'cv-pnc' : 'cv-import';
    const existingCutlistItems = jobData?.items?.filter((it) => it.source === 'cv-pnc' || it.source === 'cv-import') || [];
    const isUpdating = existingCutlistItems.length > 0;

    if (setJobData) {
      setJobData((prev) => {
        const retained = prev.items.filter((it) => it.source !== 'cv-pnc' && it.source !== 'cv-import');
        return {
          ...prev,
          items: [...retained, ...itemsToAdd],
        };
      });
    } else {
      onAddItems(itemsToAdd);
    }

    showToast({
      type: 'success',
      title: isUpdating ? 'Takeoff Synchronized' : 'Takeoff Updated',
      message: `${isUpdating ? 'Updated' : 'Pushed'} ${itemsToAdd.length} material line${itemsToAdd.length === 1 ? '' : 's'} in MTO document.`,
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Import Actions Bar */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="neu-pressed p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center gap-2"
      >
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
          <Icon name="cloud_upload" className="text-2xl text-blue-700 dark:text-blue-400" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
            Drag &amp; Drop Cabinet Vision Cutlist (.pnc, .csv, .txt, .xml)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Native support for Cabinet Vision .PNC Package databases &amp; text cutlists
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {/* Browse File */}
          <label
            htmlFor="cv-file-upload-input"
            className="neu-btn px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5"
          >
            <Icon name="folder_open" className="text-base text-slate-500 dark:text-slate-400" />
            <span>Browse File</span>
            <input
              id="cv-file-upload-input"
              name="cvFileUpload"
              type="file"
              accept=".pnc,.csv,.txt,.tsv,.xml"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleProcessFile(f);
                e.target.value = '';
              }}
            />
          </label>

          {/* Paste Clipboard */}
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="neu-btn px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
          >
            <Icon name="content_paste" className="text-base text-slate-500 dark:text-slate-400" />
            <span>Paste Clipboard</span>
          </button>

          {/* Load Sample CV Cutlist */}
          <button
            type="button"
            onClick={handleLoadSample}
            className="neu-btn px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            title="Load sample Cabinet Vision CSV cutlist with 9 parts"
          >
            <Icon name="table_chart" className="text-base text-slate-500 dark:text-slate-400" />
            <span>Load Sample CSV</span>
          </button>

          {/* Load Futrus - Two Kings (.PNC) */}
          <button
            type="button"
            onClick={handleLoadFutrusPnc}
            className="neu-btn px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1.5 border border-blue-300/60 dark:border-blue-800/60"
            title="Load Futrus - Two Kings.pnc Cabinet Vision database (30 parts across 3 assemblies)"
          >
            <Icon name="storage" className="text-base text-blue-600 dark:text-blue-400" />
            <span>Load Futrus - Two Kings (.PNC)</span>
          </button>
        </div>

        {/* If folder linked has CV exports, display quick-select chips */}
        {detectedFiles?.cvExports && detectedFiles.cvExports.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 w-full flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Found in linked folder:
            </span>
            {detectedFiles.cvExports.map((f, i) => {
              const isPnc = f.name.toLowerCase().endsWith('.pnc') || f.isPnc;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleLoadDetectedFile(f)}
                  className={`neu-btn px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1 ${
                    isPnc
                      ? 'text-blue-700 dark:text-blue-400 font-bold border border-blue-400/40'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  <Icon name={isPnc ? 'storage' : 'description'} className="text-xs" />
                  <span>{f.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PNC Active Project Banner */}
      {loadedPnc && (
        <div className="neu-flat p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Icon name="storage" className="text-xl text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 font-geometric">
                  .PNC ACTIVE:
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
                  {loadedPnc.fileName}
                </span>
              </div>
              {loadedPnc.assemblies?.length > 0 && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span>
                    <strong>Cabinets:</strong> {loadedPnc.assemblies.length} assemblies
                  </span>
                </div>
              )}
            </div>
          </div>

          {setJobData && loadedPnc.jobInfo && (
            <button
              type="button"
              onClick={handleSyncJobMeta}
              className="neu-btn px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white flex items-center gap-1.5"
              title="Sync Job Name, Job #, and Client into the Project Header"
            >
              <Icon name="sync" className="text-base text-blue-600 dark:text-blue-400" />
              <span>Apply Metadata to Job</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Global Nesting Parameters Bar */}
      <div className="neu-card-sm p-3.5 bg-neu-base/60 border border-slate-300/40 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="tune" className="text-base text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-geometric">
              NESTING CONTROLS
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {wastePercent === 0 || bufferMode === 'net'
                ? 'Net Nest (0% Buffer)'
                : bufferMode === 'area'
                ? `Smart Offcut Buffer (${wastePercent}%)`
                : `Flat Sheet Buffer (${wastePercent}%)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic Re-Nest Action Button */}
            <button
              type="button"
              onClick={handleRenest}
              disabled={isRenesting}
              className={`neu-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all ${
                isRenesting
                  ? 'text-blue-500 cursor-wait bg-blue-50/50 dark:bg-blue-950/40'
                  : 'text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
              }`}
              title="Recalculate 2D guillotine nest layouts across all material groups"
            >
              <Icon name="autorenew" className={`text-base ${isRenesting ? 'animate-spin' : ''}`} />
              <span>{isRenesting ? 'Re-Nesting...' : 'Re-Nest'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSmartcutConfig(!showSmartcutConfig)}
              className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
            >
              <span>Smartcut.dev API</span>
              {showSmartcutConfig ? <Icon name="expand_less" className="text-base" /> : <Icon name="expand_more" className="text-base" />}
            </button>
          </div>
        </div>

        {/* Global Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Default Stock Sheet */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="nest-stock-sheet-size" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                Sheet Size
              </label>
              <button
                type="button"
                onClick={handleApplySheetSizeToAll}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                title="Apply this sheet size to all non-solid-surface groups"
              >
                Apply to All
              </button>
            </div>
            <select
              id="nest-stock-sheet-size"
              name="stockSheetSize"
              value={stockSheetSize}
              onChange={(e) => handleStockSheetSizeChange(e.target.value)}
              className="neu-pressed px-2.5 py-1 text-xs font-semibold w-full text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="4x8">4x8 (48" × 96")</option>
              <option value="5x10">5x10 (60" × 120")</option>
              <option value="5x12">5x12 (60" × 144")</option>
              <option value="30x144">30x144 (Solid Surface)</option>
            </select>
          </div>

          {/* Saw Blade Kerf */}
          <div>
            <div className="mb-1">
              <label htmlFor="nest-saw-kerf" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                Blade Kerf (in)
              </label>
            </div>
            <input
              id="nest-saw-kerf"
              name="sawKerf"
              type="number"
              step="0.0625"
              min="0"
              max="1"
              value={kerf}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setKerf(isNaN(val) ? 0 : val);
              }}
              className="neu-pressed px-2.5 py-1 text-xs font-semibold w-full text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* Perimeter Edge Trim */}
          <div>
            <div className="mb-1">
              <label htmlFor="nest-edge-trim" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                Edge Trim (in)
              </label>
            </div>
            <input
              id="nest-edge-trim"
              name="edgeTrim"
              type="number"
              step="0.125"
              min="0"
              max="2"
              value={edgeTrim}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setEdgeTrim(isNaN(val) ? 0 : val);
              }}
              className="neu-pressed px-2.5 py-1 text-xs font-semibold w-full text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* Waste / Buffer Factor */}
          <div>
            <div className="mb-1">
              <label htmlFor="nest-waste-percent" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                Waste Buffer (%)
              </label>
            </div>
            <input
              id="nest-waste-percent"
              name="wastePercent"
              type="number"
              step="1"
              min="0"
              max="50"
              value={wastePercent}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setWastePercent(isNaN(val) ? 0 : val);
              }}
              className="neu-pressed px-2.5 py-1 text-xs font-semibold w-full text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Buffer Calculation Strategy Selector */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="text-[11px] font-semibold">Buffer Strategy:</span>
            <div className="neu-well inline-flex p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setBufferMode('area');
                  handleRenest();
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  bufferMode === 'area'
                    ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Unused sheet offcut covers waste first. Only adds an extra sheet if waste exceeds available offcut."
              >
                Smart Area (Recommended)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBufferMode('flat');
                  handleRenest();
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  bufferMode === 'flat'
                    ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Applies flat sheet count multiplier"
              >
                Flat Sheet %
              </button>
              <button
                type="button"
                onClick={() => {
                  setBufferMode('net');
                  setWastePercent(0);
                  handleRenest();
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  bufferMode === 'net' || wastePercent === 0
                    ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Exact net sheets with zero waste buffer"
              >
                Net Exact (0%)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            {bufferMode === 'area'
              ? 'Offcut on nested sheets absorbs waste buffer before adding sheets.'
              : bufferMode === 'net'
              ? 'Order strictly the net sheets nested by the engine.'
              : 'Direct sheet multiplier threshold.'}
          </div>
        </div>

        {/* Smartcut API Configuration Accordion */}
        {showSmartcutConfig && (
          <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="smartcut-api-key-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Smartcut.dev API Key (Optional Cloud Optimization):
              </label>
              <label htmlFor="smartcut-use-toggle" className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  id="smartcut-use-toggle"
                  name="useSmartcut"
                  type="checkbox"
                  checked={useSmartcut}
                  onChange={(e) => setUseSmartcut(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Enable Cloud Optimization</span>
              </label>
            </div>
            <div className="flex gap-2">
              <input
                id="smartcut-api-key-input"
                name="smartcutApiKey"
                type="password"
                placeholder="Paste Smartcut.dev API token..."
                value={smartcutApiKey}
                onChange={(e) => {
                  setSmartcutApiKey(e.target.value);
                  localStorage.setItem('mto_smartcut_api_key', e.target.value);
                }}
                className="neu-pressed px-3 py-1.5 text-xs flex-1 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Re-Nesting Visual Loading Banner */}
      {isRenesting && (
        <div className="flex items-center justify-center gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold animate-pulse shadow-inner">
          <Icon name="autorenew" className="text-base animate-spin text-blue-600 dark:text-blue-400" />
          <span>Recalculating 2D guillotine cut nests, blade kerfs &amp; offcut utilization...</span>
        </div>
      )}

      {/* 3. Raw Cutlist / Text Editor (Collapsible if PNC is active) */}
      {!loadedPnc && (
        <div className="neu-card-sm p-3.5 bg-neu-base/60 border border-slate-300/40 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="raw-cv-cutlist-textarea" className="text-xs font-bold text-slate-700 dark:text-slate-200 font-geometric cursor-pointer">
              RAW CUTLIST DATA (CSV / TSV / S2M TEXT)
            </label>
            {rawText && (
              <button
                type="button"
                onClick={() => setRawText('')}
                className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            id="raw-cv-cutlist-textarea"
            name="rawCutlistData"
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste Cabinet Vision cutlist CSV rows here..."
            className="neu-pressed p-2.5 text-xs font-mono w-full text-slate-800 dark:text-slate-200 focus:outline-none resize-y"
          />
        </div>
      )}

      {/* 4. Detected Material Groups & Yield Calculations Table */}
      {parseResult && parseResult.materialGroups && parseResult.materialGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-geometric">
                DETECTED MATERIAL GROUPS ({parseResult.materialGroups.length})
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total Parts: <strong>{parseResult.totalParsed}</strong>
            </span>
          </div>

          <div className="neu-card-sm overflow-hidden border border-slate-300/40 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200/50 dark:bg-slate-800/60 border-b border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 font-geometric uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        id="select-all-material-groups"
                        name="selectAllGroups"
                        aria-label="Select all material groups"
                        type="checkbox"
                        checked={Object.values(groupConfigs).every((c) => c.selected)}
                        onChange={(e) => {
                          const allChecked = e.target.checked;
                          const updated = {};
                          Object.keys(groupConfigs).forEach((k) => {
                            updated[k] = { ...groupConfigs[k], selected: allChecked };
                          });
                          setGroupConfigs(updated);
                        }}
                        className="rounded text-blue-600"
                        title="Select All"
                      />
                    </th>
                    <th className="py-2.5 px-3">Material Tag</th>
                    <th className="py-2.5 px-2 text-center">Parts</th>
                    <th className="py-2.5 px-2">Sheet Size</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-2 text-center">Nested Sheets</th>
                    <th className="py-2.5 px-3 text-center">Visual Nest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {parseResult.materialGroups.map((grp) => {
                    const cfg = groupConfigs[grp.material] || {};
                    const nestRes = groupNestCalculations[grp.material];
                    const safeKey = grp.material.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
                    const isExpanded = expandedGroup === grp.material;

                    return (
                      <React.Fragment key={grp.material}>
                        <tr className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Checkbox */}
                          <td className="py-3 px-3">
                            <input
                              id={`select-group-${safeKey}`}
                              name={`select_group_${safeKey}`}
                              aria-label={`Select ${grp.material}`}
                              type="checkbox"
                              checked={Boolean(cfg.selected)}
                              onChange={() => handleToggleSelectGroup(grp.material)}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                          </td>

                          {/* Material Tag */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedGroup(isExpanded ? null : grp.material)}
                                className="p-1 -ml-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                                title={isExpanded ? 'Collapse parts' : 'View all parts'}
                                aria-label={isExpanded ? 'Collapse parts' : 'View all parts'}
                              >
                                <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-base" />
                              </button>
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                  {grp.material}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Thick: {cfg.thickness || '3/4"'} | Core: {cfg.substrate || 'PB'}
                                  {grp.defaultSheetSize ? ` | PNC Sheet: ${grp.defaultSheetSize}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Parts (Hover for Sq Ft tooltip) */}
                          <td className="py-3 px-2 text-center">
                            <div className="relative inline-flex flex-col items-center group">
                              <span
                                className="font-bold font-mono text-slate-800 dark:text-slate-200 cursor-help underline decoration-dotted decoration-slate-400 dark:decoration-slate-500 underline-offset-4 hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none"
                                title={`${grp.totalSqFt.toFixed(2)} sq ft`}
                              >
                                {grp.totalParts} parts
                              </span>
                              {/* Hover Tooltip Notification */}
                              <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex flex-col items-center whitespace-nowrap shadow-lg">
                                <div className="neu-flat px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800">
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{grp.totalSqFt.toFixed(2)}</span> sq ft
                                </div>
                                <div className="w-2 h-2 -mt-1 rotate-45 border-r border-b border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800"></div>
                              </div>
                            </div>
                          </td>

                          {/* Sheet Size Selector */}
                          <td className="py-3 px-2">
                            <select
                              id={`group-sheet-size-${safeKey}`}
                              name={`group_sheet_size_${safeKey}`}
                              aria-label={`${grp.material} Sheet Size`}
                              value={cfg.sheetSize || grp.defaultSheetSize || stockSheetSize}
                              onChange={(e) => handleUpdateGroupConfig(grp.material, 'sheetSize', e.target.value)}
                              className="neu-pressed px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="4x8">4x8 (48" × 96")</option>
                              <option value="5x10">5x10 (60" × 120")</option>
                              <option value="5x12">5x12 (60" × 144")</option>
                              <option value="30x144">30x144 (Solid Surface)</option>
                            </select>
                          </td>

                          {/* Category Selector */}
                          <td className="py-3 px-2">
                            <select
                              id={`group-category-${safeKey}`}
                              name={`group_category_${safeKey}`}
                              aria-label={`${grp.material} Category`}
                              value={cfg.category || 'laid_up_2s'}
                              onChange={(e) => handleUpdateGroupConfig(grp.material, 'category', e.target.value)}
                              className="neu-pressed px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="laid_up_2s">Laid Up 2S</option>
                              <option value="laid_up_1s">Laid Up 1S</option>
                              <option value="loose">Loose Laminate</option>
                              <option value="solid_surface">Solid Surface</option>
                            </select>
                          </td>

                          {/* Nested Sheets Calculation */}
                          <td className={`py-3 px-2 text-center transition-all duration-200 ${isRenesting ? 'opacity-40 scale-95' : ''}`}>
                            <div className="relative inline-flex flex-col items-center group">
                              <span
                                className="font-bold font-mono text-blue-700 dark:text-blue-400 text-sm cursor-help underline decoration-dotted decoration-slate-400 dark:decoration-slate-500 underline-offset-4 hover:text-blue-600 dark:hover:text-blue-300 transition-colors select-none"
                                title={`${nestRes?.utilizationPercent || 0}% yield`}
                              >
                                {nestRes?.bufferedSheets || 1}{' '}
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                  ({nestRes?.totalSheets || 1} net)
                                </span>
                              </span>
                              {/* Hover Tooltip Notification for Yield */}
                              <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex flex-col items-center whitespace-nowrap shadow-lg">
                                <div className="neu-flat px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800">
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{nestRes?.utilizationPercent || 0}%</span> yield
                                </div>
                                <div className="w-2 h-2 -mt-1 rotate-45 border-r border-b border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800"></div>
                              </div>
                            </div>

                            {/* Offcut Covers Badge */}
                            {nestRes?.bufferedSheets === nestRes?.totalSheets && wastePercent > 0 && bufferMode === 'area' && (
                              <div className="mt-1">
                                <span
                                  className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-300/40 dark:border-emerald-800/50"
                                  title="Unutilized sheet offcut fully covers requested waste buffer without needing an extra sheet"
                                >
                                  offcut covers
                                </span>
                              </div>
                            )}
                          </td>

                          {/* View SVG Nest Button */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setPreviewNest({ nest: nestRes, material: grp.material })}
                              className="neu-btn px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 inline-flex items-center gap-1.5"
                              title="Inspect SVG nesting sheet layout"
                            >
                              <Icon name="visibility" className="text-base text-blue-600 dark:text-blue-400" />
                              <span>View Nest</span>
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Part Manifest Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 dark:bg-slate-900/50">
                            <td colSpan={7} className="p-3 border-y border-slate-200 dark:border-slate-800">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  Parts Manifest: {grp.material} ({grp.parts.length} line items, {grp.totalParts} total pieces)
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Total Area: {grp.totalSqFt.toFixed(2)} sq ft
                                </span>
                              </div>
                              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f2023]">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                                    <tr>
                                      <th className="py-1.5 px-2.5">Part Name</th>
                                      <th className="py-1.5 px-2">Cabinet Assembly</th>
                                      <th className="py-1.5 px-2 text-center">Qty</th>
                                      <th className="py-1.5 px-2 text-right">Dimensions (W × L)</th>
                                      <th className="py-1.5 px-2 text-center">Grain</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                                    {grp.parts.map((p, pIdx) => (
                                      <tr key={p.id || pIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="py-1.5 px-2.5 font-medium text-slate-800 dark:text-slate-200">
                                          {p.partName || p.name}{' '}
                                          {p.internalName ? (
                                            <span className="text-slate-400 font-mono">({p.internalName})</span>
                                          ) : null}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                                          {p.assemblyName ? (
                                            <span>
                                              {p.assemblyName} {p.assemblyNumber ? `#${p.assemblyNumber}` : ''}
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                                          {p.qty}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                          {p.width}" × {p.length}"
                                        </td>
                                        <td className="py-1.5 px-2 text-center">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              p.grainLocked
                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                            }`}
                                          >
                                            {p.grainLocked ? 'Locked' : 'Free'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Push Action Strip */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Selected: <strong>{Object.values(groupConfigs).filter((c) => c.selected).length}</strong> of{' '}
              {parseResult.materialGroups.length} material groups
            </div>
            <button
              type="button"
              onClick={handlePushSelectedToMto}
              className="neu-btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-md"
            >
              <Icon
                name={jobData?.items?.some((it) => it.source === 'cv-pnc' || it.source === 'cv-import') ? 'sync' : 'arrow_forward'}
                className="text-base text-white"
              />
              <span>
                {jobData?.items?.some((it) => it.source === 'cv-pnc' || it.source === 'cv-import')
                  ? 'Update Takeoff in MTO Document'
                  : 'Push to MTO Document'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* SVG Nest Preview Modal */}
      {previewNest && (
        <SvgNestModal
          nestResult={groupNestCalculations[previewNest.material] || previewNest.nest}
          materialName={previewNest.material}
          onUnlockGrain={handleUnlockGrainAndRenest}
          onClose={() => setPreviewNest(null)}
        />
      )}
    </div>
  );
}
