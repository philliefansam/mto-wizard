import React, { useState, useEffect } from 'react';
import Icon from './components/Icon';
import TopJobBar from './components/TopJobBar';
import MaterialWizard from './components/MaterialWizard';
import CutlistImporter from './components/CutlistImporter';
import MtoDocumentPanel from './components/MtoDocumentPanel';
import { ToastProvider } from './components/Toast';
import { getSystemUsername, formatUsernameAsEngineer } from './utils/fileSystem';

export default function App() {
  // Format current date as MM/DD/YY
  const getTodayFormatted = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  // Saved Engineer or fallback from PC username
  const getInitialEngineer = () => {
    try {
      const saved = localStorage.getItem('mto_engineer');
      if (saved && saved !== 'Sam H') return saved;
      if (typeof __PC_USERNAME__ !== 'undefined' && __PC_USERNAME__) {
        return formatUsernameAsEngineer(__PC_USERNAME__);
      }
      return '';
    } catch {
      return '';
    }
  };

  // Unified Project State (persisted to sessionStorage for the active session)
  const [jobData, setJobData] = useState(() => {
    try {
      const sessionSaved = sessionStorage.getItem('mto_job_data');
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {
      jobName: 'KOP RD BLD 12',
      jobNumber: '180180-7',
      engineer: getInitialEngineer(),
      date: getTodayFormatted(),
      items: [],
    };
  });

  // Keep sessionStorage in sync with jobData during active session
  useEffect(() => {
    try {
      sessionStorage.setItem('mto_job_data', JSON.stringify(jobData));
    } catch {}
  }, [jobData]);

  // Resolve PC username asynchronously on mount if engineer is not already set
  useEffect(() => {
    async function resolveEngineer() {
      const saved = localStorage.getItem('mto_engineer');
      if ((!saved || saved === 'Sam H') && !jobData.engineer) {
        const sysUser = await getSystemUsername();
        if (sysUser) {
          setJobData((prev) => ({
            ...prev,
            engineer: sysUser,
          }));
        }
      }
    }
    resolveEngineer();
  }, []);

  // Linked Directory & Scanned Files
  const [linkedFolder, setLinkedFolder] = useState(null);
  const [detectedFiles, setDetectedFiles] = useState({ mtoFiles: [], cvExports: [] });

  // Substrate Tag option for MTO lines (default checked yes on open)
  const [showSubstrateTag, setShowSubstrateTag] = useState(() => {
    try {
      const saved = localStorage.getItem('mto_show_substrate');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mto_show_substrate', JSON.stringify(showSubstrateTag));
    } catch {}
  }, [showSubstrateTag]);

  // Theme Mode: 'system' | 'light' | 'dark' (defaults to 'system')
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('mto_theme_mode') || 'system';
    } catch {
      return 'system';
    }
  });

  // Track live system OS dark mode preference across Windows, macOS, iOS, Android
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    // Sync on mount
    setSystemIsDark(mq.matches);

    // Live OS theme change listener (fires automatically on Windows/macOS/iOS/Android theme toggle)
    const handler = (e) => {
      setSystemIsDark(e.matches);
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  // Compute active effective theme
  const effectiveTheme = themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    try {
      localStorage.setItem('mto_theme_mode', themeMode);
    } catch {}

    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [themeMode, effectiveTheme]);

  // Left Inflow Switcher Tab: 'wizard' | 'nesting'
  const [activeLeftTab, setActiveLeftTab] = useState('wizard');

  // Push new line items to MTO document
  const handleAddItems = (newItems = []) => {
    setJobData((prev) => ({
      ...prev,
      items: [...prev.items, ...newItems],
    }));
  };

  // Reset Project State
  const handleReset = async () => {
    if (confirm('Reset all project data and clear takeoff items?')) {
      try {
        sessionStorage.removeItem('mto_job_data');
      } catch {}
      const eng = (await getSystemUsername()) || getInitialEngineer();
      setJobData({
        jobName: '',
        jobNumber: '',
        engineer: eng,
        date: getTodayFormatted(),
        items: [],
      });
      setLinkedFolder(null);
      setDetectedFiles({ mtoFiles: [], cvExports: [] });
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neu-base text-slate-800 dark:text-slate-100 p-3 sm:p-5 lg:p-6 selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <div className="max-w-[1720px] mx-auto">
          {/* Top Job Metadata & Actions Header */}
          <TopJobBar
            jobData={jobData}
            setJobData={setJobData}
            linkedFolder={linkedFolder}
            setLinkedFolder={setLinkedFolder}
            detectedFiles={detectedFiles}
            setDetectedFiles={setDetectedFiles}
            onReset={handleReset}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            effectiveTheme={effectiveTheme}
          />

          {/* Split Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ================= LEFT PANEL: INFLOW BUILDER (58% ~ 7 cols) ================= */}
            <div className="lg:col-span-7 space-y-4 no-print">
              {/* Top Inflow Tab Switcher */}
              <div className="neu-flat p-2 flex items-center justify-between">
                <div className="neu-well inline-flex p-1 gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('wizard')}
                    className={`flex-1 sm:flex-initial py-2 px-5 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      activeLeftTab === 'wizard'
                        ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon name="bolt" className="text-lg text-blue-600 dark:text-blue-400" />
                    <span>Material Wizard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLeftTab('nesting')}
                    className={`flex-1 sm:flex-initial py-2 px-5 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      activeLeftTab === 'nesting'
                        ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon name="dashboard_customize" className="text-lg text-indigo-600 dark:text-indigo-400" />
                    <span>CV Cutlist + Nesting</span>
                  </button>
                </div>
              </div>

              {/* Inflow Content Card - Keep both tabs mounted to preserve active session data */}
              <div className="neu-flat p-5 sm:p-6">
                <div className={activeLeftTab === 'wizard' ? 'block' : 'hidden'}>
                  <MaterialWizard onAddItems={handleAddItems} />
                </div>
                <div className={activeLeftTab === 'nesting' ? 'block' : 'hidden'}>
                  <CutlistImporter
                    onAddItems={handleAddItems}
                    detectedFiles={detectedFiles}
                    jobData={jobData}
                    setJobData={setJobData}
                  />
                </div>
              </div>
            </div>

            {/* ================= RIGHT PANEL: LIVE MTO DOCUMENT & EXPORT (42% ~ 5 cols) ================= */}
            <div className="lg:col-span-5 h-full">
              <MtoDocumentPanel
                jobData={jobData}
                setJobData={setJobData}
                showSubstrateTag={showSubstrateTag}
                setShowSubstrateTag={setShowSubstrateTag}
              />
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
