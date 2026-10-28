import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import {
  linkJobDirectory,
  saveMtoJson,
  promptOpenMtoJsonFile,
  supportsDirectoryPicker,
} from '../utils/fileSystem';
import { SAMPLE_MTO_STATE } from '../utils/mtoFormatter';

export default function TopJobBar({
  jobData,
  setJobData,
  linkedFolder,
  setLinkedFolder,
  detectedFiles,
  setDetectedFiles,
  onReset,
  themeMode,
  setThemeMode,
  effectiveTheme,
}) {
  const [saveStatus, setSaveStatus] = useState(null);
  const dateInputRef = useRef(null);

  // Cycle through: System Auto -> Dark -> Light -> System Auto
  const handleCycleTheme = () => {
    if (themeMode === 'system') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('light');
    } else {
      setThemeMode('system');
    }
  };

  // Convert "MM/DD/YY" or "MM/DD/YYYY" to "YYYY-MM-DD" for calendar picker
  const toIsoDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let [mm, dd, yy] = parts;
      mm = mm.padStart(2, '0');
      dd = dd.padStart(2, '0');
      const yyyy = yy.length === 2 ? `20${yy}` : yy;
      return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    return '';
  };

  // Convert "YYYY-MM-DD" back to "MM/DD/YY"
  const toShortDate = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${mm}/${dd}/${yyyy.slice(-2)}`;
    }
    return isoStr;
  };

  // Sync engineer to localStorage
  useEffect(() => {
    if (jobData.engineer) {
      localStorage.setItem('mto_engineer', jobData.engineer);
    }
  }, [jobData.engineer]);

  const handleLinkFolder = async () => {
    const res = await linkJobDirectory();
    if (res.success) {
      setLinkedFolder({
        handle: res.dirHandle,
        name: res.folderName,
      });

      // Autofill metadata if folder matches standard naming convention (from Pull Sheet Wizard logic)
      if (res.parsedMeta) {
        setJobData((prev) => ({
          ...prev,
          jobNumber: prev.jobNumber || res.parsedMeta.jobNumber || '',
          jobName: prev.jobName || res.parsedMeta.jobName || '',
        }));
      }

      setDetectedFiles({
        mtoFiles: res.mtoFiles || [],
        cvExports: res.cvExports || [],
      });
    }
  };

  const handleSaveJson = async () => {
    const res = await saveMtoJson(jobData, linkedFolder?.handle);
    if (res.success) {
      setSaveStatus(res.direct ? 'Saved to folder' : 'Downloaded JSON');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleLoadJson = async () => {
    const res = await promptOpenMtoJsonFile();
    if (res.success && res.data) {
      setJobData((prev) => ({
        ...prev,
        jobName: res.data.jobName || prev.jobName,
        jobNumber: res.data.jobNumber || prev.jobNumber,
        engineer: res.data.engineer || prev.engineer,
        date: res.data.date || prev.date,
        items: Array.isArray(res.data.items) ? res.data.items : prev.items,
      }));
    }
  };

  const handleLoadDemo = () => {
    setJobData({
      jobName: SAMPLE_MTO_STATE.jobName,
      jobNumber: SAMPLE_MTO_STATE.jobNumber,
      engineer: SAMPLE_MTO_STATE.engineer,
      date: SAMPLE_MTO_STATE.date,
      items: JSON.parse(JSON.stringify(SAMPLE_MTO_STATE.items)),
    });
  };

  return (
    <header className="neu-flat p-4 mb-6 no-print flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      {/* Brand & Badge */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <Icon name="inventory_2" className="text-2xl text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 font-geometric">
            MTO WIZARD
          </h1>
        </div>
      </div>

      {/* Metadata Form Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 max-w-3xl">
        {/* Job Name */}
        <div className="neu-pressed px-3 py-1.5 flex items-center gap-2">
          <Icon name="work_outline" className="text-slate-400 dark:text-slate-500 text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <label htmlFor="top-job-name" className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 leading-none mb-0.5 cursor-pointer">
              Job Name
            </label>
            <input
              id="top-job-name"
              name="jobName"
              type="text"
              value={jobData.jobName}
              onChange={(e) => setJobData({ ...jobData, jobName: e.target.value })}
              placeholder="KOP RD BLD 12"
              className="w-full bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none truncate"
            />
          </div>
        </div>

        {/* Job Number */}
        <div className="neu-pressed px-3 py-1.5 flex items-center gap-2">
          <Icon name="tag" className="text-slate-400 dark:text-slate-500 text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <label htmlFor="top-job-number" className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 leading-none mb-0.5 cursor-pointer">
              Job #
            </label>
            <input
              id="top-job-number"
              name="jobNumber"
              type="text"
              value={jobData.jobNumber}
              onChange={(e) => setJobData({ ...jobData, jobNumber: e.target.value })}
              placeholder="180180-7"
              className="w-full bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none truncate"
            />
          </div>
        </div>

        {/* Engineer */}
        <div className="neu-pressed px-3 py-1.5 flex items-center gap-2">
          <Icon name="person" className="text-slate-400 dark:text-slate-500 text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <label htmlFor="top-engineer" className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 leading-none mb-0.5 cursor-pointer">
              Engineer
            </label>
            <input
              id="top-engineer"
              name="engineer"
              type="text"
              value={jobData.engineer}
              onChange={(e) => setJobData({ ...jobData, engineer: e.target.value })}
              placeholder="Sam H"
              className="w-full bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none truncate"
            />
          </div>
        </div>

        {/* Date Calendar Picker */}
        <div
          onClick={() => {
            if (dateInputRef.current?.showPicker) {
              try {
                dateInputRef.current.showPicker();
              } catch {
                dateInputRef.current.focus();
              }
            } else {
              dateInputRef.current?.focus();
            }
          }}
          className="neu-pressed px-3 py-1.5 flex items-center gap-2 cursor-pointer group"
          title="Click to open calendar picker"
        >
          <Icon name="calendar_month" className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-lg shrink-0 cursor-pointer" />
          <div className="flex-1 min-w-0">
            <label htmlFor="top-job-date" className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 leading-none mb-0.5 cursor-pointer">
              Date
            </label>
            <input
              ref={dateInputRef}
              id="top-job-date"
              name="jobDate"
              type="date"
              value={toIsoDate(jobData.date)}
              onChange={(e) => {
                if (e.target.value) {
                  setJobData({ ...jobData, date: toShortDate(e.target.value) });
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.currentTarget.showPicker) {
                  try {
                    e.currentTarget.showPicker();
                  } catch {}
                }
              }}
              className="w-full bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons with Neumorphic Styling */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Theme Mode Toggle (System Auto / Dark / Light) */}
        <button
          type="button"
          onClick={handleCycleTheme}
          className="neu-icon-btn px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
          title={`Theme: ${themeMode === 'system' ? `System Auto (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})` : themeMode}. Click to cycle System / Dark / Light.`}
        >
          <Icon
            name={
              themeMode === 'system'
                ? 'brightness_auto'
                : themeMode === 'dark'
                ? 'dark_mode'
                : 'light_mode'
            }
            className={`text-lg ${
              themeMode === 'system'
                ? 'text-blue-600 dark:text-blue-400'
                : themeMode === 'dark'
                ? 'text-amber-400'
                : 'text-amber-500'
            }`}
            filled={themeMode !== 'system'}
          />
          <span className="hidden sm:inline">
            {themeMode === 'system'
              ? `Auto (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`
              : themeMode === 'dark'
              ? 'Dark'
              : 'Light'}
          </span>
        </button>

        {/* Link Folder Button */}
        <button
          onClick={handleLinkFolder}
          className={`neu-icon-btn px-3 py-2 text-xs font-semibold ${
            linkedFolder ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
          }`}
          title={linkedFolder ? `Linked to ${linkedFolder.name}` : 'Link local or network job directory'}
        >
          <Icon
            name={linkedFolder ? "folder_managed" : "folder_open"}
            className={linkedFolder ? "text-emerald-600 dark:text-emerald-400 text-lg" : "text-slate-600 dark:text-slate-400 text-lg"}
            filled={Boolean(linkedFolder)}
          />
          <span className="max-w-[110px] truncate">{linkedFolder ? linkedFolder.name : 'Link Folder'}</span>
        </button>

        {/* Demo Preset */}
        <button
          onClick={handleLoadDemo}
          className="neu-icon-btn px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          title="Load KOP RD BLD 12 sample takeoff"
        >
          <Icon name="science" className="text-indigo-600 dark:text-indigo-400 text-lg" />
          <span>Demo</span>
        </button>

        {/* Load JSON */}
        <button
          onClick={handleLoadJson}
          className="neu-icon-btn px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
          title="Load MTO JSON file"
        >
          <Icon name="upload_file" className="text-slate-600 dark:text-slate-400 text-lg" />
          <span>Load</span>
        </button>

        {/* Save JSON */}
        <button
          onClick={handleSaveJson}
          className="neu-icon-btn px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400"
          title="Save MTO JSON file"
        >
          <Icon name="save" className="text-blue-600 dark:text-blue-400 text-lg" />
          <span>{saveStatus || 'Save'}</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="neu-icon-btn px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          title="Reset all takeoff items and fields"
        >
          <Icon name="restart_alt" className="text-rose-600 dark:text-rose-400 text-lg" />
        </button>
      </div>
    </header>
  );
}
