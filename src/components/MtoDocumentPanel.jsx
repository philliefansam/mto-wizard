import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { useToast } from './Toast';
import {
  formatMtoDescription,
  calculateComponentBreakdown,
} from '../utils/mtoFormatter';

export default function MtoDocumentPanel({
  jobData,
  setJobData,
  showSubstrateTag,
  setShowSubstrateTag,
}) {
  const { showToast } = useToast();
  const [activeView, setActiveView] = useState('standard'); // 'standard' | 'breakdown'
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [emailStatus, setEmailStatus] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const mtoItems = jobData.items || [];

  // Update item quantity
  const handleUpdateQty = (itemId, delta) => {
    setJobData((prev) => ({
      ...prev,
      items: prev.items
        .map((it) => {
          if (it.id === itemId) {
            const newQty = Math.max(1, (it.qty || 1) + delta);
            return { ...it, qty: newQty };
          }
          return it;
        })
        .filter(Boolean),
    }));
  };

  // Delete item
  const handleDeleteItem = (itemId) => {
    setJobData((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
  };

  // Start inline editing
  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setEditingText(formatMtoDescription(item, showSubstrateTag));
  };

  // Save inline edit
  const handleSaveEdit = (itemId) => {
    setJobData((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id === itemId) {
          return { ...it, customOverrideText: editingText.trim() };
        }
        return it;
      }),
    }));
    setEditingItemId(null);
  };

  // Calculate Purchasing Component Breakdown
  const breakdown = calculateComponentBreakdown(mtoItems);

  // Detailed Sheet & Purchasing Statistics calculation
  // Laid-Up 2S consumes 2 decorative laminate sheets per substrate
  // Laid-Up 1S (Face + Backer) consumes 1 decorative laminate sheet to order (backer is stocked in shop)
  const sheetStats = useMemo(() => {
    let laidUpPanels = 0;
    let laidUpLaminateSheets = 0;
    let coreSubstrates = 0;
    let looseLaminateSheets = 0;
    let backerSheetsFromStock = 0;
    let solidSurfaceSheets = 0;
    let otherSheets = 0;

    for (const item of mtoItems) {
      const qty = Number(item.qty) || 0;
      if (qty <= 0) continue;

      const cat = item.category;
      const sides = (item.sides || '').trim().toUpperCase();

      if (cat === 'laid_up') {
        laidUpPanels += qty;
        coreSubstrates += qty;
        if (sides === 'RAW CORE ONLY' || sides === 'RAW CORE') {
          // No laminate faces needed
        } else if (sides === '1S' || sides === 'FACE + BACKER' || sides.includes('1S') || sides.includes('BACKER')) {
          laidUpLaminateSheets += qty * 1; // 1 decorative face sheet to order
          backerSheetsFromStock += qty * 1; // 1 backer sheet from in-house stock
        } else {
          // 2S (Face + Back): 2 decorative laminate sheets per laminated substrate
          laidUpLaminateSheets += qty * 2;
        }
      } else if (cat === 'loose') {
        looseLaminateSheets += qty;
      } else if (cat === 'solid_surface') {
        solidSurfaceSheets += qty;
      } else {
        otherSheets += qty;
      }
    }

    const totalLaminateSheets = laidUpLaminateSheets + looseLaminateSheets;

    return {
      laidUpPanels,
      laidUpLaminateSheets,
      coreSubstrates,
      looseLaminateSheets,
      backerSheetsFromStock,
      solidSurfaceSheets,
      otherSheets,
      totalLaminateSheets,
    };
  }, [mtoItems]);

  // Total raw line item quantity
  const totalSheetsCount = sheetStats.totalLaminateSheets;

  // Build universally compatible email data (Native Outlook HTML Table + Clean Columnar Plain Text)
  const buildUniversalEmailData = () => {
    const isStandard = activeView === 'standard';
    const itemsToExport = isStandard
      ? mtoItems.map((it) => ({
          qty: `(${it.qty})`,
          desc: formatMtoDescription(it, showSubstrateTag),
        }))
      : breakdown.allItems.map((it) => ({
          qty: `(${it.qty})`,
          desc: `${it.category} — ${it.description}`,
        }));

    const jobName = jobData.jobName || 'UNTITLED PROJECT';
    const jobNum = jobData.jobNumber || '—';
    const engineer = jobData.engineer || 'Sam H';
    const date = jobData.date || '';

    // 1. Universally compatible Plain Text: Works on 100% of devices (iOS, Android, Windows, Mac, webmail)
    // Uses clear box borders and aligned column spacing + tabs so it never collapses into unreadable text
    const textLines = [
      '======================================================================',
      `MATERIAL TAKEOFF: ${jobName}`,
      `Job #: ${jobNum}   |   Engineer: ${engineer}   |   Date: ${date}`,
      '======================================================================',
      '',
      'QTY       \tDESCRIPTION',
      '----------------------------------------------------------------------',
      ...itemsToExport.map((r) => `${r.qty.padEnd(10)}\t${r.desc}`),
      '----------------------------------------------------------------------',
    ];

    if (isStandard) {
      textLines.push('SHEET & PANEL BREAKDOWN:');
      if (sheetStats.laidUpPanels > 0) {
        textLines.push(
          `  • Laid-Up Panels:        ${sheetStats.laidUpPanels} panels (${sheetStats.laidUpLaminateSheets} face laminate sheets to order${sheetStats.backerSheetsFromStock > 0 ? ` + ${sheetStats.backerSheetsFromStock} backer from shop stock` : ''})`
        );
      }
      if (sheetStats.looseLaminateSheets > 0) {
        textLines.push(
          `  • Loose Laminate:        ${sheetStats.looseLaminateSheets} sheets (plain sheets)`
        );
      }
      if (sheetStats.solidSurfaceSheets > 0) {
        textLines.push(
          `  • Solid Surface:         ${sheetStats.solidSurfaceSheets} sheet${sheetStats.solidSurfaceSheets === 1 ? '' : 's'}`
        );
      }
      if (sheetStats.otherSheets > 0) {
        textLines.push(
          `  • Other Materials:       ${sheetStats.otherSheets} sheet${sheetStats.otherSheets === 1 ? '' : 's'}`
        );
      }
      textLines.push('----------------------------------------------------------------------');
      textLines.push('PURCHASING TOTALS:');
      textLines.push(
        `  • Total Laminate Sheets: ${sheetStats.totalLaminateSheets} sheets (${sheetStats.laidUpLaminateSheets} layup faces + ${sheetStats.looseLaminateSheets} loose)`
      );
      if (sheetStats.coreSubstrates > 0) {
        textLines.push(
          `  • Raw Core Substrates:   ${sheetStats.coreSubstrates} panel${sheetStats.coreSubstrates === 1 ? '' : 's'}`
        );
      }
      if (sheetStats.backerSheetsFromStock > 0) {
        textLines.push(
          `  • Shop Stock Backer:     ${sheetStats.backerSheetsFromStock} sheet${sheetStats.backerSheetsFromStock === 1 ? '' : 's'} (from internal inventory)`
        );
      }
      if (sheetStats.solidSurfaceSheets > 0) {
        textLines.push(
          `  • Solid Surface Slabs:   ${sheetStats.solidSurfaceSheets} sheet${sheetStats.solidSurfaceSheets === 1 ? '' : 's'}`
        );
      }
    } else {
      textLines.push('PURCHASING TOTALS:');
      textLines.push(`  • Raw Core Substrates:   ${sheetStats.coreSubstrates} panels`);
      textLines.push(`  • Total Laminate Sheets: ${sheetStats.totalLaminateSheets} sheets to order`);
      if (sheetStats.backerSheetsFromStock > 0) {
        textLines.push(`  • Shop Stock Backer:     ${sheetStats.backerSheetsFromStock} sheets (internal stock)`);
      }
      if (sheetStats.solidSurfaceSheets > 0) {
        textLines.push(`  • Solid Surface Slabs:   ${sheetStats.solidSurfaceSheets} sheet${sheetStats.solidSurfaceSheets === 1 ? '' : 's'}`);
      }
    }
    textLines.push('======================================================================');

    const plainText = textLines.join('\n');

    // 2. Fast, universally compatible Native Outlook / Gmail HTML Table
    // Standard HTML 3.2/4.0 attributes (border="1", cellpadding="6", cellspacing="0", width)
    // ensure Microsoft Outlook, Gmail, Apple Mail, and Word render a real table with visible borders
    const htmlRows = itemsToExport
      .map(
        (r, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td width="70" align="center" style="padding: 7px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; width: 70px; color: #0f172a;">${r.qty}</td>
          <td align="left" style="padding: 7px 12px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">${r.desc}</td>
        </tr>`
      )
      .join('');

    const htmlContent = `
      <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; max-width: 650px;">
        <div style="margin-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; color: #0f172a; text-transform: uppercase;">Material Takeoff: ${jobName}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            <strong>Job #:</strong> ${jobNum} &nbsp;|&nbsp; <strong>Engineer:</strong> ${engineer} &nbsp;|&nbsp; <strong>Date:</strong> ${date}
          </div>
        </div>
        <table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 13px; width: 100%; max-width: 650px; border: 1px solid #94a3b8;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th width="70" align="center" style="padding: 8px 12px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; width: 70px; color: #0f172a; background-color: #f1f5f9;">Qty</th>
              <th align="left" style="padding: 8px 12px; border: 1px solid #94a3b8; text-align: left; font-weight: bold; color: #0f172a; background-color: #f1f5f9;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="2" style="padding: 6px 12px; border: 1px solid #94a3b8; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; background-color: #f1f5f9;">
                Takeoff Breakdown &amp; Purchasing Totals
              </td>
            </tr>
            ${sheetStats.laidUpPanels > 0 ? `
            <tr style="background-color: #ffffff; font-size: 12px; color: #1e293b;">
              <td width="70" align="center" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; width: 70px;">${sheetStats.laidUpPanels}</td>
              <td align="left" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">
                <strong>Laid-Up Panels</strong> &mdash; <strong>${sheetStats.laidUpLaminateSheets}</strong> face laminate sheets to order${sheetStats.backerSheetsFromStock > 0 ? ` (+ ${sheetStats.backerSheetsFromStock} backer from shop stock)` : ''} + <strong>${sheetStats.coreSubstrates}</strong> raw core ${sheetStats.coreSubstrates === 1 ? 'board' : 'boards'}
              </td>
            </tr>` : ''}
            ${sheetStats.looseLaminateSheets > 0 ? `
            <tr style="background-color: #ffffff; font-size: 12px; color: #1e293b;">
              <td width="70" align="center" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; width: 70px;">${sheetStats.looseLaminateSheets}</td>
              <td align="left" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">
                <strong>Loose Laminate Sheets</strong> (Plain sheets)
              </td>
            </tr>` : ''}
            ${sheetStats.solidSurfaceSheets > 0 ? `
            <tr style="background-color: #ffffff; font-size: 12px; color: #1e293b;">
              <td width="70" align="center" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; width: 70px;">${sheetStats.solidSurfaceSheets}</td>
              <td align="left" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">
                <strong>Solid Surface</strong> ${sheetStats.solidSurfaceSheets === 1 ? 'Sheet' : 'Sheets'}
              </td>
            </tr>` : ''}
            ${sheetStats.otherSheets > 0 ? `
            <tr style="background-color: #ffffff; font-size: 12px; color: #1e293b;">
              <td width="70" align="center" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; width: 70px;">${sheetStats.otherSheets}</td>
              <td align="left" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">
                <strong>Other Materials</strong>
              </td>
            </tr>` : ''}
            <tr style="background-color: #eff6ff; font-weight: bold; font-size: 13px;">
              <td width="70" align="center" style="padding: 8px 12px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; width: 70px; color: #1d4ed8; background-color: #eff6ff;">${sheetStats.totalLaminateSheets}</td>
              <td align="left" style="padding: 8px 12px; border: 1px solid #94a3b8; text-align: left; font-weight: bold; color: #1d4ed8; background-color: #eff6ff;">
                TOTAL LAMINATE SHEETS TO ORDER ${sheetStats.laidUpLaminateSheets > 0 && sheetStats.looseLaminateSheets > 0 ? `(${sheetStats.laidUpLaminateSheets} layup faces + ${sheetStats.looseLaminateSheets} loose)` : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    return { plainText, htmlContent };
  };

  // Copy table to clipboard in both native HTML table and tabbed plain text
  const handleCopyForEmail = async () => {
    const { plainText, htmlContent } = buildUniversalEmailData();

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }

      setCopiedStatus(true);
      showToast({
        type: 'success',
        title: 'Copied to Clipboard',
        message: 'Formatted MTO table copied. Ready to paste directly into Outlook, Word, or Excel.',
      });
      setTimeout(() => setCopiedStatus(false), 2500);
    } catch (err) {
      console.warn('ClipboardItem error, falling back to writeText:', err);
      try {
        await navigator.clipboard.writeText(plainText);
        setCopiedStatus(true);
        showToast({
          type: 'success',
          title: 'Copied Plaintext',
          message: 'MTO text copied to clipboard.',
        });
        setTimeout(() => setCopiedStatus(false), 2500);
      } catch (e) {
        showToast({
          type: 'error',
          title: 'Clipboard Error',
          message: 'Could not copy to clipboard. Please copy manually.',
        });
      }
    }
  };

  // Trigger mailto client with cleanly formatted columns & copy table to clipboard
  const handleOpenEmail = async () => {
    const { plainText, htmlContent } = buildUniversalEmailData();
    const subject = encodeURIComponent(`Material Takeoff: ${jobData.jobName || 'MTO'} (${jobData.jobNumber || ''})`);
    const body = encodeURIComponent(plainText);

    // Write full HTML source formatting and plain text to clipboard
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }

    setEmailStatus(true);
    showToast({
      type: 'info',
      title: 'Email Draft & Table Ready',
      message: 'Launching email client. The formatted table is in your clipboard — press Ctrl+V (Keep Source Formatting) in the email body!',
    });
    setTimeout(() => setEmailStatus(false), 4000);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Top Control Strip (no-print) */}
      <div className="neu-card-sm p-3 bg-neu-base/70 flex flex-wrap items-center justify-between gap-3 no-print">
        {/* View Switcher Pills */}
        <div className="neu-well inline-flex p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveView('standard')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'standard'
                ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Icon name="description" className="text-base" />
            <span>Standard MTO Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('breakdown')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'breakdown'
                ? 'neu-btn-active text-blue-700 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Icon name="calculate" className="text-base" />
            <span>Raw Purchasing Totals</span>
          </button>
        </div>

        {/* Substrate Tag Toggle */}
        <div className="flex items-center gap-3">
          <label htmlFor="mto-include-substrate-toggle" className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              id="mto-include-substrate-toggle"
              name="includeSubstrateTag"
              type="checkbox"
              checked={showSubstrateTag}
              onChange={(e) => setShowSubstrateTag(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Include Substrate in Line Text</span>
          </label>
        </div>
      </div>

      {/* 2. The Live Paper Document (Screen + Print Format) */}
      <div className="print-container flex-1 bg-white dark:bg-[#28292c] rounded-2xl shadow-xl p-8 sm:p-12 border border-slate-200 dark:border-[#3c4043] text-slate-800 dark:text-[#e8eaed] transition-all min-h-[580px] flex flex-col justify-between">
        <div>
          {/* Header Section */}
          <header className="text-center font-geometric">
            <h2 className="text-3xl sm:text-4xl font-normal tracking-wide text-slate-800 dark:text-slate-100 font-geometric">
              Material Takeoff
            </h2>
            <h3 className="text-xl sm:text-2xl mt-1.5 text-slate-700 dark:text-slate-300 font-normal tracking-tight font-geometric">
              {activeView === 'breakdown'
                ? `${jobData.jobName || 'UNTITLED PROJECT'} — Raw Purchasing Breakdown`
                : jobData.jobName || 'UNTITLED PROJECT'}
            </h3>

            {/* Engineer & Job # Row */}
            <div className="flex justify-between items-baseline border-b-2 border-slate-400 dark:border-slate-600 pb-1.5 mt-6 text-base sm:text-lg font-geometric">
              <div className="font-normal text-slate-900 dark:text-slate-100">
                {jobData.engineer || 'Sam H'}
              </div>
              <div className="font-normal text-slate-900 dark:text-slate-100 font-mono sm:font-geometric">
                {jobData.jobNumber || '—'}
              </div>
            </div>
          </header>

          {/* ================= VIEW 1: STANDARD MTO SHEET ================= */}
          {activeView === 'standard' && (
            <div className="mt-4">
              <table className="w-full border-collapse font-geometric">
                <thead>
                  <tr className="text-base sm:text-lg font-normal text-slate-900 dark:text-slate-100">
                    <th className="text-left w-24 py-1.5 underline underline-offset-4 font-normal">
                      Qty
                    </th>
                    <th className="text-left py-1.5 underline underline-offset-4 font-normal">
                      Description
                    </th>
                    <th className="w-12 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {mtoItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-12 text-center text-slate-400 italic text-base font-sans"
                      >
                        No material items added yet. Use the Material Wizard on the left or load the Demo.
                      </td>
                    </tr>
                  ) : (
                    mtoItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-300 dark:border-slate-800 py-3 text-base sm:text-lg hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Qty Cell */}
                        <td className="py-3 font-normal text-slate-900 dark:text-slate-100 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-normal tracking-wide">({item.qty})</span>
                            <div className="hidden group-hover:inline-flex items-center gap-0.5 no-print ml-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, -1)}
                                className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px]"
                                title="Decrease qty"
                              >
                                <Icon name="remove" className="text-xs" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, 1)}
                                className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px]"
                                title="Increase qty"
                              >
                                <Icon name="add" className="text-xs" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Description Cell */}
                        <td className="py-3 font-normal text-slate-900 dark:text-slate-100 align-top">
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-2 no-print">
                              <input
                                id={`edit-item-desc-${item.id}`}
                                name={`edit_item_desc_${item.id}`}
                                aria-label="Edit item description"
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(item.id);
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                                className="border border-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded px-2 py-1 text-base w-full focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                className="p-1 rounded bg-blue-600 text-white flex items-center justify-center"
                                title="Save"
                              >
                                <Icon name="check" className="text-base text-white" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleStartEdit(item)}
                              className="cursor-pointer group-hover:text-blue-950 dark:group-hover:text-blue-300 transition-colors"
                              title="Click to edit description"
                            >
                              {formatMtoDescription(item, showSubstrateTag)}
                            </div>
                          )}
                        </td>

                        {/* Row Actions (no-print) */}
                        <td className="py-3 text-right no-print align-top">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded flex items-center"
                              title="Edit text"
                            >
                              <Icon name="edit" className="text-base" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-rose-400 hover:text-rose-600 rounded flex items-center"
                              title="Delete row"
                            >
                              <Icon name="delete" className="text-base" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {mtoItems.length > 0 && (
                  <tfoot className="border-t-2 border-slate-400 dark:border-slate-600 font-geometric">
                    <tr className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                      <td colSpan={3} className="pt-4 pb-1">
                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                          Takeoff Breakdown:
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-800 dark:text-slate-200">
                          {sheetStats.laidUpPanels > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                                {sheetStats.laidUpPanels}
                              </span>
                              <span>
                                Laid-Up Panels ({sheetStats.laidUpLaminateSheets} face laminate {sheetStats.laidUpLaminateSheets === 1 ? 'sheet' : 'sheets'} to order
                                {sheetStats.backerSheetsFromStock > 0 ? ` + ${sheetStats.backerSheetsFromStock} backer from stock` : ''})
                              </span>
                            </span>
                          )}
                          {sheetStats.looseLaminateSheets > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                {sheetStats.looseLaminateSheets}
                              </span>
                              <span>Loose Laminate Sheets</span>
                            </span>
                          )}
                          {sheetStats.solidSurfaceSheets > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/60">
                                {sheetStats.solidSurfaceSheets}
                              </span>
                              <span>Solid Surface</span>
                            </span>
                          )}
                          {sheetStats.otherSheets > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {sheetStats.otherSheets}
                              </span>
                              <span>Other</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700/80">
                      <td className="py-2.5 font-mono text-blue-600 dark:text-blue-400">
                        {sheetStats.totalLaminateSheets}
                      </td>
                      <td className="py-2.5" colSpan={2}>
                        Total Laminate Sheets to Order {sheetStats.laidUpLaminateSheets > 0 && sheetStats.looseLaminateSheets > 0 ? `(${sheetStats.laidUpLaminateSheets} layup faces + ${sheetStats.looseLaminateSheets} loose)` : ''}
                        {sheetStats.coreSubstrates > 0 ? ` · ${sheetStats.coreSubstrates} Core Boards` : ''}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ================= VIEW 2: RAW PURCHASING TOTALS ================= */}
          {activeView === 'breakdown' && (
            <div className="mt-6 space-y-6 font-geometric">
              {/* 1. Raw Substrates (Cores) */}
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-[#3c4043] pb-1 uppercase tracking-wide">
                  1. Raw Substrates (Cores Needed)
                </h4>
                {breakdown.substrates.length === 0 ? (
                  <p className="text-sm text-slate-500 py-2 italic font-sans">
                    No laid-up panel substrates in current takeoff.
                  </p>
                ) : (
                  <table className="w-full text-base sm:text-lg border-collapse mt-2">
                    <tbody>
                      {breakdown.substrates.map((s, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-[#3c4043]/60 py-2">
                          <td className="w-24 py-2 font-normal text-slate-900 dark:text-slate-100">({s.qty})</td>
                          <td className="py-2 font-normal text-slate-900 dark:text-slate-100">{s.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 2. Laminate Sheets (Face + Backer + Loose) */}
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-[#3c4043] pb-1 uppercase tracking-wide">
                  2. Laminate Sheets (HPL / Backers Needed)
                </h4>
                {breakdown.laminates.length === 0 ? (
                  <p className="text-sm text-slate-500 py-2 italic font-sans">
                    No laminates in current takeoff.
                  </p>
                ) : (
                  <table className="w-full text-base sm:text-lg border-collapse mt-2">
                    <tbody>
                      {breakdown.laminates.map((l, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-[#3c4043]/60 py-2">
                          <td className="w-24 py-2 font-normal text-slate-900 dark:text-slate-100">({l.qty})</td>
                          <td className="py-2 font-normal text-slate-900 dark:text-slate-100">{l.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 3. Solid Surface / Other */}
              {breakdown.solidSurfaces.length > 0 && (
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-[#3c4043] pb-1 uppercase tracking-wide">
                    3. Solid Surface / Other Materials
                  </h4>
                  <table className="w-full text-base sm:text-lg border-collapse mt-2">
                    <tbody>
                      {breakdown.solidSurfaces.map((ss, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-[#3c4043]/60 py-2">
                          <td className="w-24 py-2 font-normal text-slate-900 dark:text-slate-100">({ss.qty})</td>
                          <td className="py-2 font-normal text-slate-900 dark:text-slate-100">{ss.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Document Footer */}
        <footer className="mt-12 pt-3 border-t-2 border-slate-400 flex items-center justify-end font-geometric">
          <div className="text-base sm:text-lg text-slate-900 dark:text-slate-100 font-normal">
            {jobData.date || '06/04/26'}
          </div>
        </footer>
      </div>

      {/* 3. Bottom Export Action Bar (no-print) */}
      <div className="neu-flat p-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="neu-btn-primary px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2"
            title="Print or Save as PDF (Ctrl+P)"
          >
            <Icon name="print" className="text-lg text-white" />
            <span>Print / Save PDF</span>
          </button>

          {/* Copy Table for Email */}
          <button
            type="button"
            onClick={handleCopyForEmail}
            className={`neu-icon-btn px-4 py-2.5 text-xs sm:text-sm font-bold ${
              copiedStatus ? 'text-emerald-700 dark:text-emerald-400 active' : 'text-slate-700 dark:text-slate-300'
            }`}
            title="Copy styled table and text for pasting into Outlook / Gmail"
          >
            <Icon
              name={copiedStatus ? "check_circle" : "content_copy"}
              className={copiedStatus ? "text-emerald-600 dark:text-emerald-400 text-lg" : "text-slate-600 dark:text-slate-400 text-lg"}
              filled={copiedStatus}
            />
            <span>{copiedStatus ? 'Copied to Clipboard!' : 'Copy for Email'}</span>
          </button>

          {/* Open in Email */}
          <button
            type="button"
            onClick={handleOpenEmail}
            className={`neu-icon-btn px-4 py-2.5 text-xs sm:text-sm font-bold ${
              emailStatus ? 'text-blue-700 dark:text-blue-400 active' : 'text-slate-700 dark:text-slate-300'
            }`}
            title="Create email draft with formatted table (also copies table for Ctrl+V)"
          >
            <Icon
              name={emailStatus ? "mark_email_read" : "mail"}
              className={emailStatus ? "text-blue-600 dark:text-blue-400 text-lg" : "text-slate-600 dark:text-slate-400 text-lg"}
              filled={emailStatus}
            />
            <span>{emailStatus ? 'Draft Opened (Table Copied!)' : 'Open in Email'}</span>
          </button>
        </div>

        {/* Clear Items Button */}
        {mtoItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear all takeoff line items?')) {
                setJobData((prev) => ({ ...prev, items: [] }));
              }
            }}
            className="neu-icon-btn px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
            title="Clear all rows from takeoff table"
          >
            <Icon name="delete_sweep" className="text-rose-600 dark:text-rose-400 text-lg" />
            <span>Clear Table</span>
          </button>
        )}
      </div>
    </div>
  );
}
