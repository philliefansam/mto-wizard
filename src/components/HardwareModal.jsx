import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { formatHardwareFullLine } from '../utils/mtoFormatter';

/**
 * Optimize image file into compressed base64 data URL
 * Scales down large images to max 400x400 to preserve sessionStorage quota
 */
function optimizeImageFile(file, maxDim = 400) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, 0.88));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export default function HardwareModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
}) {
  const isEditing = Boolean(initialData && initialData.id);

  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [isPair, setIsPair] = useState(false);
  const [url, setUrl] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [image, setImage] = useState('');
  const [imageZoom, setImageZoom] = useState(1);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);
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

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setQty(initialData.qty || 1);
        setIsPair(Boolean(initialData.isPair));
        setUrl(initialData.url || '');
        setSize(initialData.size || '');
        setColor(initialData.color || '');
        setImage(initialData.image || '');
        setImageZoom(Number(initialData.imageZoom) > 0 ? Number(initialData.imageZoom) : 1);
        setImageLoadError(false);
        setImageUrlInput(initialData.image && initialData.image.startsWith('http') ? initialData.image : '');
        setShowUrlInput(Boolean(initialData.image && initialData.image.startsWith('http')));
      } else {
        setName('');
        setQty(1);
        setIsPair(false);
        setUrl('');
        setSize('');
        setColor('');
        setImage('');
        setImageZoom(1);
        setImageLoadError(false);
        setImageUrlInput('');
        setShowUrlInput(false);
      }
      setErrorMsg('');
    }
  }, [isOpen, initialData]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const optimized = await optimizeImageFile(file);
      if (optimized) {
        setImage(optimized);
        setImageZoom(1);
        setImageLoadError(false);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const optimized = await optimizeImageFile(file);
      if (optimized) {
        setImage(optimized);
        setImageZoom(1);
        setImageLoadError(false);
      }
    }
  };

  const isSafeUrl = (val, allowDataImage = false) => {
    if (!val) return true;
    const trimmed = val.trim();
    if (allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) return true;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleApplyImageUrl = () => {
    const candidate = imageUrlInput.trim();
    if (candidate) {
      if (!isSafeUrl(candidate, true)) {
        setErrorMsg('Image URL must use https://, http://, or an image data URI.');
        return;
      }
      setErrorMsg('');
      setImage(candidate);
      setImageZoom(1);
      setImageLoadError(false);
      setShowUrlInput(false);
    }
  };

  const handleClearImage = () => {
    setImage('');
    setImageZoom(1);
    setImageLoadError(false);
    setImageUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Hardware Name is required.');
      return;
    }
    const numQty = parseInt(qty, 10);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMsg('Quantity must be a positive number (1 or more).');
      return;
    }
    if (url.trim() && !isSafeUrl(url.trim(), false)) {
      setErrorMsg('Product / Supplier URL must start with http:// or https://.');
      return;
    }

    onSave({
      id: initialData?.id || undefined,
      name: name.trim(),
      qty: numQty,
      isPair: Boolean(isPair),
      url: url.trim(),
      size: size.trim(),
      color: color.trim(),
      image: image.trim(),
      imageZoom: Number(imageZoom) || 1,
    });

    onClose();
  };

  // Preview object
  const previewItem = {
    name: name.trim() || 'Hardware Name',
    qty: Math.max(1, parseInt(qty, 10) || 1),
    isPair,
    size: size.trim(),
    color: color.trim(),
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="hardware-modal-title"
      onCancel={(e) => {
        if (e.target !== dialogRef.current) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto p-0 bg-transparent border-0 max-w-2xl sm:max-w-[700px] w-[calc(100%-2rem)] backdrop:bg-black/60 backdrop:backdrop-blur-sm no-print"
    >
      {isOpen && (
      <div className="bg-white dark:bg-[#202124] border border-slate-200 dark:border-[#3c4043] rounded-2xl shadow-2xl max-w-2xl sm:max-w-[700px] w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-[#e8eaed] font-sans">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#3c4043] flex items-center justify-between bg-slate-50 dark:bg-[#28292c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Icon name="construction" className="text-xl" />
            </div>
            <div>
              <h2 id="hardware-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 font-geometric">
                {isEditing ? 'Edit Hardware Item' : 'Add Hardware to Takeoff'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adds a custom hardware line under "Additional Job Hardware"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            title="Close modal"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <Icon name="error" className="text-base text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Row: Empty "+" Image Box & Primary Details */}
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
            {/* The Blank "+" Image Upload Box */}
            <div className="shrink-0 flex flex-col items-center">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Hardware Photo
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => {
                  if (!image && fileInputRef.current) fileInputRef.current.click();
                }}
                className={`w-36 h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 scale-105'
                    : image
                    ? 'border-slate-300 dark:border-slate-600 bg-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 bg-slate-50 dark:bg-slate-800/40'
                }`}
                title={image ? 'Hardware picture' : 'Click or drop picture here to upload'}
              >
                {image ? (
                  <>
                    {imageLoadError ? (
                      <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-slate-500">
                        <Icon name="image" className="text-2xl mb-1" />
                        <span className="text-[10px] font-semibold leading-tight">
                          Preview unavailable
                        </span>
                      </div>
                    ) : (
                      <img
                        src={image}
                        alt="Hardware preview"
                        onError={() => setImageLoadError(true)}
                        className="w-full h-full object-contain p-1 transition-transform duration-75"
                        style={{ transform: imageZoom !== 1 ? `scale(${imageZoom})` : undefined }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearImage();
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow"
                      title="Remove picture"
                    >
                      <Icon name="close" className="text-xs text-white" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-slate-400 dark:text-slate-500">
                    <Icon name="add" className="text-3xl text-slate-400 dark:text-slate-500 mb-1" />
                    <span className="text-[11px] font-semibold leading-tight px-2">
                      Drop / Click to Upload
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                onCancel={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
              />

              {image && !imageLoadError && (
                <div className="mt-2 w-36 flex items-center gap-1.5 px-1" title="Zoom image for edge cases">
                  <Icon name="zoom_in" className="text-xs text-slate-400 dark:text-slate-500 shrink-0" />
                  <input
                    id="hw-image-zoom"
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={imageZoom}
                    onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                    aria-label="Image zoom"
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setImageZoom(1)}
                    className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 min-w-[2.25rem] text-right"
                    title="Reset zoom to 100%"
                  >
                    {Math.round(imageZoom * 100)}%
                  </button>
                </div>
              )}

              {/* URL or Toggle Link (matches w-36 photo box) */}
              <div className="mt-2 w-36 text-center">
                {!showUrlInput ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {image ? 'Change URL' : 'or enter image URL'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 w-36">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyImageUrl}
                      className="px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shrink-0"
                      title="Apply image URL"
                    >
                      ✓
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Name & Quantity */}
            <div className="flex-1 w-full space-y-4">
              {/* Name (Required) */}
              <div>
                <label
                  htmlFor="hw-name"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Hardware Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="hw-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g. Blum Clip Top Blumotion 110 Hinges"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium transition-colors"
                  autoFocus
                />
              </div>

              {/* Quantity (Required) & Pairs Checkbox */}
              <div>
                <label
                  htmlFor="hw-qty"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Quantity <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <input
                    id="hw-qty"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-28 sm:w-32 px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold font-mono"
                  />
                  <label className="flex items-center gap-2.5 py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={isPair}
                      onChange={(e) => setIsPair(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pairs <span className="text-slate-400 font-normal">(e.g. PR for slides/hinges)</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Size & Color Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Size (Optional) */}
            <div>
              <label
                htmlFor="hw-size"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Size / Specs <span className="text-slate-400 text-[10px] font-normal">(optional)</span>
              </label>
              <input
                id="hw-size"
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 22&quot; or 128mm CC or 1/2&quot; Overlay"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Color (Optional) */}
            <div>
              <label
                htmlFor="hw-color"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Color / Finish <span className="text-slate-400 text-[10px] font-normal">(optional)</span>
              </label>
              <input
                id="hw-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Matte Black, Satin Nickel, White"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* URL Field (Optional) */}
          <div>
            <label
              htmlFor="hw-url"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Product / Supplier URL <span className="text-slate-400 text-[10px] font-normal">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Icon name="link" className="text-base" />
              </div>
              <input
                id="hw-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.hafele.com/... or supplier item link"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Baked as a clickable hyperlink on the readable hardware name in print, PDF, and email exports.
            </p>
          </div>

          {/* Live Preview Box */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Takeoff Line Preview:</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-normal">
                (QTY)-[NAME]-[SIZE]-[COLOR]
              </span>
            </div>
            <div className="p-3.5 sm:p-4 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3.5">
              {image && !imageLoadError ? (
                <div className="w-11 h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                  <img
                    src={image}
                    alt="Thumbnail"
                    onError={() => setImageLoadError(true)}
                    className="w-full h-full object-contain p-0.5 transition-transform duration-75"
                    style={{ transform: imageZoom !== 1 ? `scale(${imageZoom})` : undefined }}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                  <Icon name="image" className="text-xl" />
                </div>
              )}
              <div className="min-w-0 flex-1 font-geometric text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                {formatHardwareFullLine(previewItem)}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-[#3c4043] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neu-btn-primary px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow"
            >
              <Icon name={isEditing ? 'save' : 'add'} className="text-base text-white" />
              <span>{isEditing ? 'Save Changes' : 'Add Hardware Item'}</span>
            </button>
          </div>
        </form>
      </div>
      )}
    </dialog>
  );
}
