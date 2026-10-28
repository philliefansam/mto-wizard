import { parseJobAndProjectFromPath } from './mtoFormatter';

export const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);
export const supportsDirectoryPicker = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/**
 * Format raw OS username into professional engineer display name
 * e.g. "shanni" -> "Shanni", "john.doe" -> "John Doe"
 */
export function formatUsernameAsEngineer(rawName) {
  if (!rawName) return '';
  const clean = String(rawName).trim();
  if (clean.includes('.')) {
    return clean
      .split('.')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Retrieve the active logged in PC username via environment define,
 * Electron bridge, or local companion listener
 */
export async function getSystemUsername() {
  // 1. Electron bridge
  if (typeof window !== 'undefined' && window.electronAPI?.getUsername) {
    try {
      const u = await window.electronAPI.getUsername();
      if (u) return formatUsernameAsEngineer(u);
    } catch {}
  }

  // 2. Companion server check (Pull Sheet Wizard server on port 9994 or current origin)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('http://localhost:9994/api/status', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.username) return formatUsernameAsEngineer(data.username);
    }
  } catch {}

  // 3. Current origin /api/status if hosted
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/status', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.username) return formatUsernameAsEngineer(data.username);
    }
  } catch {}

  // 4. Injected compile-time PC Username from host machine
  if (typeof __PC_USERNAME__ !== 'undefined' && __PC_USERNAME__) {
    return formatUsernameAsEngineer(__PC_USERNAME__);
  }

  return '';
}

/**
 * Link a job directory to scan for MTO files and Cabinet Vision exports
 */
export async function linkJobDirectory() {
  if (isElectron) {
    try {
      const result = await window.electronAPI.selectOrScanFolder();
      return result;
    } catch (err) {
      console.error('Electron folder selection error:', err);
      return { success: false, error: err.message };
    }
  }

  if (supportsDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        id: 'mto-wizard-jobs',
        mode: 'readwrite',
      });

      const mtoFiles = [];
      const cvExports = [];

      // Scan directory entries
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith('.mto.json') || lowerName.endsWith('_mto.json') || lowerName === 'mto.json') {
            mtoFiles.push({ name: entry.name, handle: entry });
          } else if (
            lowerName.endsWith('.pnc') ||
            lowerName.endsWith('.csv') ||
            lowerName.endsWith('.txt') ||
            lowerName.endsWith('.xml') ||
            lowerName.endsWith('.ord') ||
            lowerName.endsWith('.tsv')
          ) {
            cvExports.push({
              name: entry.name,
              handle: entry,
              isPnc: lowerName.endsWith('.pnc'),
            });
          }
        }
      }

      return {
        success: true,
        dirHandle,
        folderName: dirHandle.name,
        parsedMeta: parseJobAndProjectFromPath(dirHandle.name),
        mtoFiles,
        cvExports,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.warn('Directory Picker error, falling back:', err);
      return { success: false, error: err.message };
    }
  }

  return {
    success: false,
    unsupported: true,
    message: 'Directory Picker API is not supported in this browser. Use manual file upload instead.',
  };
}

/**
 * Save project state as JSON directly to linked folder or prompt browser download
 */
export async function saveMtoJson(projectData, dirHandle = null) {
  const sanitize = (str) => (str || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const jobNum = sanitize(projectData.jobNumber);
  const jobName = sanitize(projectData.jobName);
  const fileName = `${jobNum || jobName || 'Project'}_MTO.json`;
  const jsonContent = JSON.stringify(projectData, null, 2);

  if (isElectron && window.electronAPI?.saveMtoFile) {
    try {
      const result = await window.electronAPI.saveMtoFile(fileName, jsonContent);
      return { success: true, fileName, direct: true, path: result?.path };
    } catch (err) {
      console.error('Electron save failed:', err);
    }
  }

  if (dirHandle && supportsDirectoryPicker) {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonContent);
      await writable.close();
      return { success: true, fileName, direct: true };
    } catch (err) {
      console.warn('Direct directory save failed, falling back to download:', err);
    }
  }

  // Fallback: Browser download trigger
  try {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return { success: true, fileName, direct: false };
  } catch (err) {
    console.error('Browser download failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Load MTO state from a file handle or browser File object
 */
export async function loadMtoJson(fileOrHandle) {
  try {
    let file;
    if (fileOrHandle && typeof fileOrHandle.getFile === 'function') {
      file = await fileOrHandle.getFile();
    } else {
      file = fileOrHandle;
    }

    const text = await file.text();
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (err) {
    console.error('Error reading MTO JSON file:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger an open file dialog for .mto.json files
 */
export function promptOpenMtoJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.mto.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve({ success: false, aborted: true });
        return;
      }
      const res = await loadMtoJson(file);
      resolve(res);
    };
    input.click();
  });
}
