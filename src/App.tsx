import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Disc,
  Download,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe,
  HardDrive,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildXISOImageBlob,
  BuildXISOInputItem,
  ExtractionProgress,
  extractSingleFileBlob,
  formatBytes,
  parseXISOFile,
  SECTOR_SIZE,
  XDVDFSEntry,
  XDVDFSVolume,
} from './lib/xdvdfs';
import { createZipFromEntries, triggerBlobDownload } from './lib/zipBuilder';
import {
  detectSystemLanguage,
  LanguageCode,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
} from './lib/i18n';

type AppMode = 'extract' | 'create';
type SortField = 'name' | 'size' | 'sector';

interface CreateFileEntry {
  id: string;
  relativePath: string;
  file: File;
  sizeBytes: number;
}

const LANG_STORAGE_KEY = 'extract_xiso_language';

export default function App() {
  const [mode, setMode] = useState<AppMode>('extract');

  // Language & Settings State (defaults to 'system' -> matches OS language automatically)
  const [languageChoice, setLanguageChoice] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'system';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'language' | 'credits'>('language');
  const [langSearchQuery, setLangSearchQuery] = useState<string>('');

  const resolvedLang = useMemo(
    () => resolveLanguage(languageChoice),
    [languageChoice]
  );
  const t = TRANSLATIONS[resolvedLang] || TRANSLATIONS.en;

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, languageChoice);
    } catch {
      // ignore
    }
    document.documentElement.lang = resolvedLang;
    document.documentElement.dir = resolvedLang === 'ar' ? 'rtl' : 'ltr';
  }, [languageChoice, resolvedLang]);

  // Extract / Inspect Mode State
  const [volume, setVolume] = useState<XDVDFSVolume | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectedEntry, setInspectedEntry] = useState<XDVDFSEntry | null>(null);
  const [patchXbe, setPatchXbe] = useState<boolean>(true);

  // Create Mode (-c) State
  const [createItems, setCreateItems] = useState<CreateFileEntry[]>([]);
  const [outputIsoName, setOutputIsoName] = useState<string>('game.xiso.iso');
  const [createPatchXbe, setCreatePatchXbe] = useState<boolean>(true);

  // Shared Task / Progress / Error State
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const isoInputRef = useRef<HTMLInputElement | null>(null);
  const createFolderInputRef = useRef<HTMLInputElement | null>(null);
  const createFilesInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle opening an .iso / .xiso file
  async function handleOpenIsoFile(file: File) {
    setErrorMessage(null);
    setStatusBanner(null);
    setIsBusy(true);
    setProgress({
      phase: 'reading',
      currentFile: file.name,
      processedFiles: 0,
      totalFiles: 1,
      processedBytes: 0,
      totalBytes: file.size,
    });

    try {
      const parsed = await parseXISOFile(file);
      setVolume(parsed);
      setCurrentPath('/');
      setSearchQuery('');
      setSelectedIds(new Set());
      setInspectedEntry(null);
      setMode('extract');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error reading XISO file.';
      setErrorMessage(msg);
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleOpenIsoFile(file);
    }
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (isBusy) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (
      mode === 'extract' ||
      (files.length === 1 && /\.(iso|xiso|bin)$/i.test(files[0].name))
    ) {
      handleOpenIsoFile(files[0]);
    } else {
      addFilesToCreateList(files);
    }
  }

  // Visible entries for current folder or search query
  const visibleEntries = useMemo(() => {
    if (!volume) return [];
    const q = searchQuery.trim().toLowerCase();

    const filtered = volume.flatEntries.filter((entry) => {
      if (q.length > 0) {
        return (
          entry.name.toLowerCase().includes(q) ||
          entry.path.toLowerCase().includes(q)
        );
      }
      return entry.parentPath === currentPath;
    });

    return [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      if (sortField === 'size') return b.sizeBytes - a.sizeBytes;
      if (sortField === 'sector') return a.startSector - b.startSector;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [volume, currentPath, searchQuery, sortField]);

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (currentPath === '/') return [{ label: 'Root', path: '/' }];
    const parts = currentPath.split('/').filter(Boolean);
    const items = [{ label: 'Root', path: '/' }];
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      items.push({ label: part, path: acc });
    }
    return items;
  }, [currentPath]);

  // Toggle selection of an entry (and its children if directory)
  function toggleSelectEntry(entry: XDVDFSEntry, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = !next.has(entry.id);

      function applyRecursive(item: XDVDFSEntry) {
        if (shouldSelect) next.add(item.id);
        else next.delete(item.id);
        if (item.children) {
          for (const child of item.children) applyRecursive(child);
        }
      }

      applyRecursive(entry);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const allVisibleSelected =
      visibleEntries.length > 0 &&
      visibleEntries.every((e) => selectedIds.has(e.id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const entry of visibleEntries) {
        function applyRecursive(item: XDVDFSEntry) {
          if (allVisibleSelected) next.delete(item.id);
          else next.add(item.id);
          if (item.children) {
            for (const c of item.children) applyRecursive(c);
          }
        }
        applyRecursive(entry);
      }
      return next;
    });
  }

  // Extract a single file directly
  async function handleExtractSingleFile(entry: XDVDFSEntry) {
    if (entry.isDirectory || isBusy) return;
    setErrorMessage(null);
    setStatusBanner(null);
    setIsBusy(true);
    setProgress({
      phase: 'extracting',
      currentFile: entry.path,
      processedFiles: 1,
      totalFiles: 1,
      processedBytes: 0,
      totalBytes: entry.sizeBytes,
    });

    try {
      const blob = await extractSingleFileBlob(entry, patchXbe);
      triggerBlobDownload(blob, entry.name);
      setStatusBanner(
        `${t.statusFileExported}: ${entry.name} (${formatBytes(blob.size)})`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error extracting file.'
      );
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  // Extract full ISO or selected entries to ZIP (-x)
  async function handleExtractArchive(onlySelected: boolean) {
    if (!volume || isBusy) return;
    setErrorMessage(null);
    setStatusBanner(null);

    const targetEntries = onlySelected
      ? volume.flatEntries.filter((e) => selectedIds.has(e.id) && !e.isDirectory)
      : volume.rootEntries;

    if (onlySelected && targetEntries.length === 0) return;

    if (onlySelected && targetEntries.length === 1 && !targetEntries[0].isDirectory) {
      await handleExtractSingleFile(targetEntries[0]);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsBusy(true);

    try {
      const zipBlob = await createZipFromEntries(targetEntries, {
        patchXbe,
        onProgress: (p) => setProgress({ ...p }),
        signal: abortController.signal,
      });

      const baseIsoName = volume.fileName.replace(/\.(xiso|iso|bin)$/i, '');
      const zipName = onlySelected
        ? `${baseIsoName}_selected.zip`
        : `${baseIsoName}_extracted.zip`;

      triggerBlobDownload(zipBlob, zipName);
      setStatusBanner(
        `${t.statusZipCompleted}: ${zipName} (${formatBytes(zipBlob.size)})`
      );
    } catch (err) {
      if (!abortController.signal.aborted) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Error exporting ZIP.'
        );
      }
    } finally {
      setIsBusy(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }

  // Extract directly to a local folder if File System Access API is supported
  async function handleExtractToDirectory() {
    if (!volume || isBusy) return;
    const win = window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: string }) => Promise<any>;
    };

    if (typeof win.showDirectoryPicker !== 'function') {
      await handleExtractArchive(false);
      return;
    }

    setErrorMessage(null);
    setStatusBanner(null);

    try {
      const dirHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
      setIsBusy(true);

      const filesOnly = volume.flatEntries.filter((e) => !e.isDirectory);
      const totalBytes = filesOnly.reduce((acc, f) => acc + f.sizeBytes, 0);
      let processedBytes = 0;

      for (let i = 0; i < filesOnly.length; i++) {
        const entry = filesOnly[i];
        setProgress({
          phase: 'extracting',
          currentFile: entry.path,
          processedFiles: i + 1,
          totalFiles: filesOnly.length,
          processedBytes,
          totalBytes,
        });

        const segments = entry.path.split('/').filter(Boolean);
        const fileName = segments.pop()!;
        let currentDir = dirHandle;
        for (const seg of segments) {
          currentDir = await currentDir.getDirectoryHandle(seg, { create: true });
        }

        const fileHandle = await currentDir.getFileHandle(fileName, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        const blob = await extractSingleFileBlob(entry, patchXbe);
        await writable.write(blob);
        await writable.close();

        processedBytes += entry.sizeBytes;
      }

      setStatusBanner(`${t.statusFolderExtracted} (${filesOnly.length})`);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMessage(
          err instanceof Error ? err.message : 'Error writing to folder.'
        );
      }
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  // Rewrite / Optimize XISO (-r flag in extract-xiso)
  async function handleRewriteOptimizedIso(onlySelected: boolean = false) {
    if (!volume || isBusy) return;
    setErrorMessage(null);
    setStatusBanner(null);
    setIsBusy(true);

    try {
      const sourceEntries = onlySelected
        ? volume.flatEntries.filter((e) => selectedIds.has(e.id) && !e.isDirectory)
        : volume.flatEntries.filter((e) => !e.isDirectory);

      if (sourceEntries.length === 0) {
        throw new Error('No files selected for XISO generation.');
      }

      const buildItems: BuildXISOInputItem[] = sourceEntries.map((entry) => {
        const partOffset = entry.partitionOffset ?? 0;
        const startByte = partOffset + entry.startSector * SECTOR_SIZE;
        const dataBlob = entry.sourceFile
          ? entry.sourceFile.slice(startByte, startByte + entry.sizeBytes)
          : new Blob([]);
        return {
          path: entry.path,
          isDirectory: false,
          dataBlob,
          sizeBytes: entry.sizeBytes,
        };
      });

      const isoBlob = await buildXISOImageBlob(buildItems, {
        patchXbe,
        onProgress: (p) => setProgress({ ...p }),
      });

      const baseName = volume.fileName.replace(/\.(xiso|iso|bin)$/i, '');
      const outName = `${baseName}_rebuilt.iso`;
      triggerBlobDownload(isoBlob, outName);
      setStatusBanner(
        `${t.statusOptimizedExported}: ${outName} (${formatBytes(isoBlob.size)})`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error rebuilding XISO image.'
      );
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  // Add files/folders to Create XISO (-c) mode
  function addFilesToCreateList(fileList: FileList | File[]) {
    const incoming: CreateFileEntry[] = [];
    const arr = Array.from(fileList);

    for (const f of arr) {
      if (f.name.startsWith('.')) continue;
      const relRaw =
        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const parts = relRaw.split('/').filter(Boolean);
      const normalizedPath =
        parts.length > 1 ? `/${parts.slice(1).join('/')}` : `/${f.name}`;

      incoming.push({
        id: `${normalizedPath}-${f.size}-${f.lastModified}`,
        relativePath: normalizedPath,
        file: f,
        sizeBytes: f.size,
      });
    }

    setCreateItems((prev) => {
      const map = new Map(prev.map((item) => [item.relativePath.toUpperCase(), item]));
      for (const item of incoming) {
        map.set(item.relativePath.toUpperCase(), item);
      }
      return Array.from(map.values()).sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath)
      );
    });
  }

  // Build new XISO from local files (-c flag in extract-xiso)
  async function handleBuildNewXiso() {
    if (createItems.length === 0 || isBusy) return;
    setErrorMessage(null);
    setStatusBanner(null);
    setIsBusy(true);

    try {
      const buildItems: BuildXISOInputItem[] = createItems.map((item) => ({
        path: item.relativePath,
        isDirectory: false,
        dataBlob: item.file,
        sizeBytes: item.sizeBytes,
      }));

      const isoBlob = await buildXISOImageBlob(buildItems, {
        patchXbe: createPatchXbe,
        onProgress: (p) => setProgress({ ...p }),
      });

      const cleanName = outputIsoName.trim() || 'game.iso';
      const finalName = /\.(iso|xiso)$/i.test(cleanName)
        ? cleanName
        : `${cleanName}.iso`;

      triggerBlobDownload(isoBlob, finalName);
      setStatusBanner(
        `${t.statusCreatedSuccess}: ${finalName} (${formatBytes(isoBlob.size)})`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error creating XISO file.'
      );
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }

  const selectedFileCount = useMemo(() => {
    if (!volume) return 0;
    return volume.flatEntries.filter(
      (e) => !e.isDirectory && selectedIds.has(e.id)
    ).length;
  }, [volume, selectedIds]);

  const selectedBytesCount = useMemo(() => {
    if (!volume) return 0;
    return volume.flatEntries
      .filter((e) => !e.isDirectory && selectedIds.has(e.id))
      .reduce((acc, e) => acc + e.sizeBytes, 0);
  }, [volume, selectedIds]);

  const totalCreateBytes = useMemo(
    () => createItems.reduce((acc, item) => acc + item.sizeBytes, 0),
    [createItems]
  );

  const filteredLanguages = useMemo(() => {
    const q = langSearchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearchQuery]);

  const systemDetectedOption = useMemo(() => {
    const sysCode = detectSystemLanguage();
    return SUPPORTED_LANGUAGES.find((l) => l.code === sysCode);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {/* Hidden File Inputs */}
      <input
        ref={isoInputRef}
        type="file"
        accept=".iso,.xiso,.bin,application/octet-stream"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={createFolderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is standard for folder selection
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          if (e.target.files) addFilesToCreateList(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={createFilesInputRef}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files) addFilesToCreateList(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-14 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setMode('extract');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Extract-XISO
        </a>

        {/* Zone 2: Navigation Links + Settings Link */}
        <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode('extract')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              mode === 'extract'
                ? 'text-white border-[#22C55E]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {t.navExtract}
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              mode === 'create'
                ? 'text-white border-[#22C55E]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {t.navCreate}
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsTab('language');
              setIsSettingsOpen(true);
            }}
            className="py-1 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title={t.settingsTitle}
          >
            <Settings className="w-4 h-4" />
            <span>{t.settingsTitle}</span>
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => isoInputRef.current?.click()}
            disabled={isBusy}
            className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#107C10] hover:bg-[#159615] active:scale-[0.99] rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Disc className="w-4 h-4" />
            <span>{t.openXisoButton}</span>
          </button>
        </div>
      </header>

      {/* Settings Modal (Language & Selectable Credits) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-[#22C55E]" />
                <h2 className="text-base font-bold text-white font-display">
                  {t.settingsTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                aria-label={t.closeButton}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Settings Navigation Tabs: Language vs Credits */}
            <div className="px-5 pt-3 border-b border-slate-800 bg-[#090D16]/60 flex items-center gap-6 text-xs sm:text-sm font-semibold">
              <button
                type="button"
                onClick={() => setSettingsTab('language')}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  settingsTab === 'language'
                    ? 'border-[#22C55E] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4 text-[#22C55E]" />
                <span>{t.languageLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('credits')}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  settingsTab === 'credits'
                    ? 'border-[#22C55E] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-4 h-4 text-[#22C55E]" />
                <span>Credits</span>
              </button>
            </div>

            {settingsTab === 'language' ? (
              <>
                <div className="p-4 border-b border-slate-800 bg-[#090D16]/50">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={langSearchQuery}
                      onChange={(e) => setLangSearchQuery(e.target.value)}
                      placeholder={t.searchLanguagePlaceholder}
                      className="w-full min-h-[42px] pl-10 pr-8 py-2 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#22C55E]"
                    />
                    {langSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLangSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-800/60 overflow-y-auto flex-1">
                  {filteredLanguages.map((lang) => {
                    const isSelected = languageChoice === lang.code;
                    const isSystem = lang.code === 'system';

                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguageChoice(lang.code);
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full min-h-[52px] px-5 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/30 text-white'
                            : 'hover:bg-slate-800/50 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <span>{lang.nativeName}</span>
                            {isSystem && systemDetectedOption && (
                              <span className="text-xs font-normal text-emerald-400">
                                ({systemDetectedOption.nativeName})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {isSystem ? t.systemLanguageDesc : lang.englishName}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#107C10] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Selectable Credits Row at the bottom of Settings */}
                  <button
                    type="button"
                    onClick={() => setSettingsTab('credits')}
                    className="w-full min-h-[54px] px-5 py-3.5 flex items-center justify-between gap-3 text-left bg-[#090D16]/60 hover:bg-slate-800/60 text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode className="w-4 h-4 text-[#22C55E]" />
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Credits & Open Source Licenses
                        </div>
                        <div className="text-xs text-slate-400">
                          About the iOS port, software stack & authors
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </>
            ) : (
              /* English Credits View */
              <div className="p-5 overflow-y-auto flex-1 space-y-5 text-sm text-slate-300 leading-relaxed">
                <div className="p-4 rounded-xl bg-[#090D16] border border-slate-800 space-y-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                    Open Source iOS Port
                  </div>
                  <h3 className="text-base font-bold text-white font-display">
                    Extract-XISO for iOS & Web
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This application is <strong className="text-white">Open Source</strong> software released under the{' '}
                    <strong className="text-white">BSD 4-Clause License</strong>. It is the native{' '}
                    <strong className="text-white">iOS port</strong> and web companion of the official{' '}
                    <span className="font-mono text-emerald-400">extract-xiso</span> command-line utility from:
                  </p>
                  <a
                    href="https://github.com/xboxdev/extract-xiso"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 underline break-all"
                  >
                    https://github.com/xboxdev/extract-xiso
                  </a>
                  <p className="text-xs text-slate-400 pt-1">
                    Originally created by <span className="font-mono text-slate-300">in &lt;in@fishtank.com&gt;</span> and maintained by the{' '}
                    <strong className="text-slate-200">XboxDev</strong> open-source community.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#090D16] border border-slate-800 space-y-2.5">
                  <div className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                    Software & Technologies Used
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li>
                      <strong className="text-white">Google AI Studio:</strong> Engineered, architected, and built using Google AI Studio.
                    </li>
                    <li>
                      <strong className="text-white">Swift 5 &amp; SwiftUI:</strong> Native iOS user interface, localization engine, and state management.
                    </li>
                    <li>
                      <strong className="text-white">UIKit (UIDocumentPickerViewController):</strong> Zero-copy in-place file access and directory export compatible with iOS Files and LiveContainer.
                    </li>
                    <li>
                      <strong className="text-white">C11 &amp; POSIX File I/O (XISOBridge):</strong> Native 64-bit binary XDVDFS filesystem parser, AVL directory tree walker, Redump XGD1/XGD2/XGD3 partition detector, and <span className="font-mono">.xbe</span> media patcher.
                    </li>
                    <li>
                      <strong className="text-white">XcodeGen &amp; GitHub Actions:</strong> Automated cloud build pipeline (<span className="font-mono">macos-14</span>, <span className="font-mono">xcodebuild</span>) for generating the unsigned <span className="font-mono">.ipa</span> package.
                    </li>
                    <li>
                      <strong className="text-white">React 19, TypeScript &amp; Vite:</strong> Cross-platform browser-based XDVDFS inspector, ISO rewriter (<span className="font-mono">-r</span>), ISO creator (<span className="font-mono">-c</span>), and streaming ZIP64 archive builder.
                    </li>
                    <li>
                      <strong className="text-white">Tailwind CSS &amp; Lucide Icons:</strong> Dark interface styling and vector iconography.
                    </li>
                  </ul>
                </div>

                <div className="pt-2 pb-1 text-center">
                  <p className="text-sm font-semibold text-white tracking-wide">
                    Created with ❤️ by hiperema
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-950/60 border border-red-800/70 text-red-200 text-sm">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-1 text-red-300 hover:text-white"
              aria-label={t.closeButton}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Completion Status Banner */}
        {statusBanner && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="p-1 text-emerald-300 hover:text-white"
              aria-label={t.closeButton}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Progress Bar Modal / Strip */}
        {isBusy && progress && (
          <div className="p-4 rounded-2xl bg-[#111827] border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-medium text-white truncate max-w-[70%]">
                {progress.phase === 'reading' && t.phaseReading}
                {progress.phase === 'extracting' && t.phaseExtracting}
                {progress.phase === 'rewriting' && t.phaseRewriting}
                <span className="font-mono text-emerald-400">
                  {progress.currentFile}
                </span>
              </span>
              <span className="font-mono tabular-nums text-slate-300 shrink-0">
                {progress.processedFiles} / {progress.totalFiles} {t.filesLabel}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22C55E] transition-all duration-150"
                style={{
                  width: `${
                    progress.totalBytes > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (progress.processedBytes / progress.totalBytes) * 100
                          )
                        )
                      : Math.min(
                          100,
                          Math.round(
                            (progress.processedFiles /
                              Math.max(1, progress.totalFiles)) *
                              100
                          )
                        )
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
              <span>
                {formatBytes(progress.processedBytes)} /{' '}
                {formatBytes(progress.totalBytes)}
              </span>
              {abortControllerRef.current && (
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="text-red-400 hover:text-red-300 font-sans font-medium"
                >
                  {t.cancelButton}
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODE 1: EXTRACT, BROWSE & OPTIMIZE XISO */}
        {mode === 'extract' && (
          <>
            {!volume ? (
              /* Empty Dropzone State (iOS Files Style) */
              <div
                onClick={() => !isBusy && isoInputRef.current?.click()}
                className={`flex-1 min-h-[420px] rounded-2xl border border-dashed transition-colors flex flex-col items-center justify-center p-8 text-center cursor-pointer ${
                  isDraggingOver
                    ? 'border-[#22C55E] bg-emerald-950/20'
                    : 'border-slate-800 bg-[#111827]/70 hover:border-slate-700 hover:bg-[#111827]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#107C10]/20 border border-[#22C55E]/30 flex items-center justify-center mb-5">
                  <Disc className="w-8 h-8 text-[#22C55E]" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white font-display mb-2">
                  {t.emptyTitle}
                </h1>
                <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                  {t.emptySubtitle}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    isoInputRef.current?.click();
                  }}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#107C10] hover:bg-[#159615] text-white font-semibold text-sm flex items-center gap-2.5 shadow-lg transition-all cursor-pointer"
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>{t.browseDeviceButton}</span>
                </button>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 font-mono">
                  <span>XISO (0x10000)</span>
                  <span aria-hidden="true">·</span>
                  <span>XGD1 (0x18300000)</span>
                  <span aria-hidden="true">·</span>
                  <span>Xbox 360 XGD2 (0x0FD90000)</span>
                  <span aria-hidden="true">·</span>
                  <span>XGD3 (0x02080000)</span>
                </div>
              </div>
            ) : (
              /* Loaded Volume Workspace */
              <div className="flex flex-col gap-4">
                {/* Volume Summary Strip */}
                <section className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Disc className="w-5 h-5 text-[#22C55E] shrink-0" />
                      <h1 className="text-lg sm:text-xl font-bold text-white font-display truncate">
                        {volume.xbeMetadata?.titleName || volume.fileName}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono tabular-nums">
                      <span className="text-slate-300">{volume.fileName}</span>
                      {volume.xbeMetadata && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400">
                            ID: {volume.xbeMetadata.titleIdHex}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {volume.totalFiles} {t.filesLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {volume.totalDirectories} {t.foldersLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.dataSizeLabel}: {formatBytes(volume.totalDataBytes)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.imageSizeLabel}: {formatBytes(volume.fileSize)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{volume.partitionTypeLabel}</span>
                    </div>
                  </div>

                  {/* Primary Volume Actions (-x, -r, -m) */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <label className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={patchXbe}
                        onChange={(e) => setPatchXbe(e.target.checked)}
                        className="w-4 h-4 accent-[#107C10] rounded"
                      />
                      <span>{t.patchXbeLabel}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRewriteOptimizedIso(false)}
                      disabled={isBusy}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>{t.optimizeXisoButton}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExtractArchive(false)}
                      disabled={isBusy}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#107C10] hover:bg-[#159615] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <Archive className="w-4 h-4" />
                      <span>{t.extractAllZipButton}</span>
                    </button>

                    {typeof (window as any).showDirectoryPicker === 'function' && (
                      <button
                        type="button"
                        onClick={handleExtractToDirectory}
                        disabled={isBusy}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-400" />
                        <span>{t.extractToFolderButton}</span>
                      </button>
                    )}
                  </div>
                </section>

                {/* File Browser Container (iOS Files Dark Theme) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div
                    className={`${
                      inspectedEntry ? 'lg:col-span-8' : 'lg:col-span-12'
                    } rounded-2xl bg-[#111827] border border-slate-800 overflow-hidden flex flex-col`}
                  >
                    {/* Browser Toolbar: Breadcrumbs, Search & Sort */}
                    <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/50">
                      {/* Breadcrumb Navigation */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-sm">
                        {currentPath !== '/' && (
                          <button
                            type="button"
                            onClick={() => {
                              const parts = currentPath.split('/').filter(Boolean);
                              parts.pop();
                              setCurrentPath(
                                parts.length === 0 ? '/' : `/${parts.join('/')}`
                              );
                            }}
                            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1 text-xs font-medium shrink-0 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>{t.backButton}</span>
                          </button>
                        )}

                        {breadcrumbs.map((crumb, idx) => (
                          <React.Fragment key={crumb.path}>
                            {idx > 0 && (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setCurrentPath(crumb.path);
                              }}
                              className={`px-2 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                idx === breadcrumbs.length - 1 && !searchQuery
                                  ? 'bg-slate-800 text-white font-semibold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {crumb.label}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Search & Sort Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex-1 sm:w-56">
                          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full min-h-[38px] pl-9 pr-7 py-1.5 rounded-xl bg-[#090D16] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#22C55E]"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 bg-[#090D16] border border-slate-800 rounded-xl p-1">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5 hidden sm:inline" />
                          {(['name', 'size', 'sector'] as SortField[]).map((field) => (
                            <button
                              key={field}
                              type="button"
                              onClick={() => setSortField(field)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                sortField === field
                                  ? 'bg-slate-800 text-white'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {field === 'name'
                                ? t.sortName
                                : field === 'size'
                                ? t.sortSize
                                : t.sortSector}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Selection Action Bar */}
                    {selectedFileCount > 0 && (
                      <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-emerald-300 font-mono tabular-nums">
                          {selectedFileCount} {t.selectedFilesCount} ·{' '}
                          {formatBytes(selectedBytesCount)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExtractArchive(true)}
                            disabled={isBusy}
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-[#107C10] hover:bg-[#159615] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{t.extractSelectedButton}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRewriteOptimizedIso(true)}
                            disabled={isBusy}
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                          >
                            <Disc className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t.exportSelectedXisoButton}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedIds(new Set())}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            {t.deselectButton}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Table Column Header */}
                    <div className="px-4 py-2 border-b border-slate-800/80 bg-[#090D16]/40 flex items-center justify-between text-[11px] font-medium text-slate-400">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleSelectAllVisible}
                          className="w-5 h-5 rounded border border-slate-700 flex items-center justify-center hover:border-slate-500 cursor-pointer"
                        >
                          {visibleEntries.length > 0 &&
                            visibleEntries.every((e) => selectedIds.has(e.id)) && (
                              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                            )}
                        </button>
                        <span>{t.colName}</span>
                      </div>
                      <div className="flex items-center gap-6 pr-10">
                        <span className="hidden sm:inline">{t.colSector}</span>
                        <span>{t.colSize}</span>
                      </div>
                    </div>

                    {/* Directory Rows List */}
                    <div className="divide-y divide-slate-800/60 max-h-[540px] overflow-y-auto">
                      {visibleEntries.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                          {t.noFilesFound}
                        </div>
                      ) : (
                        visibleEntries.map((entry) => {
                          const isSelected = selectedIds.has(entry.id);
                          const lowerName = entry.name.toLowerCase();
                          const isXbe = lowerName.endsWith('.xbe');
                          const isXex = lowerName.endsWith('.xex');
                          const isExec = isXbe || isXex;

                          return (
                            <div
                              key={entry.id}
                              onClick={() => {
                                if (entry.isDirectory) {
                                  setSearchQuery('');
                                  setCurrentPath(entry.path);
                                } else {
                                  setInspectedEntry(entry);
                                }
                              }}
                              className={`min-h-[54px] px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                inspectedEntry?.id === entry.id
                                  ? 'bg-slate-800/80'
                                  : isSelected
                                  ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Left: Checkbox + File/Folder Icon + Name */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => toggleSelectEntry(entry, e)}
                                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#107C10] border-[#22C55E] text-white'
                                      : 'border-slate-700 hover:border-slate-500'
                                  }`}
                                  aria-label={entry.name}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </button>

                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    entry.isDirectory
                                      ? 'bg-emerald-950/50 text-[#22C55E]'
                                      : isExec
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {entry.isDirectory ? (
                                    <Folder className="w-4 h-4 fill-current" />
                                  ) : isExec ? (
                                    <FileCode className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-100 truncate">
                                    {entry.name}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono tabular-nums truncate">
                                    {searchQuery ? `${entry.path} · ` : ''}
                                    {entry.isDirectory
                                      ? `${entry.children?.length ?? 0} ${t.itemsCount}`
                                      : isXbe
                                      ? t.xboxExec
                                      : isXex
                                      ? t.xbox360Exec
                                      : `Offset 0x${(
                                          (entry.partitionOffset ?? 0) +
                                          entry.startSector * SECTOR_SIZE
                                        )
                                          .toString(16)
                                          .toUpperCase()}`}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Sector + Size + Direct Action */}
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400">
                                  #{entry.startSector}
                                </span>
                                <span className="text-xs font-mono tabular-nums text-slate-300 w-20 text-right">
                                  {entry.isDirectory
                                    ? t.folderBadge
                                    : formatBytes(entry.sizeBytes)}
                                </span>

                                {entry.isDirectory ? (
                                  <div className="w-9 h-9 flex items-center justify-center text-slate-500">
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExtractSingleFile(entry);
                                    }}
                                    disabled={isBusy}
                                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-[#107C10] text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                    title={`${t.exportFileButton} ${entry.name}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* File Inspector Side Panel */}
                  {inspectedEntry && (
                    <aside className="lg:col-span-4 rounded-2xl bg-[#111827] border border-slate-800 p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-mono text-emerald-400">
                            {t.detailsHeader}
                          </span>
                          <h2 className="text-base font-bold text-white truncate mt-0.5">
                            {inspectedEntry.name}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedEntry(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2.5 text-xs border-t border-b border-slate-800 py-3.5 font-mono tabular-nums">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400 font-sans">
                            {t.pathLabel}
                          </span>
                          <span className="text-slate-200 truncate">
                            {inspectedEntry.path}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400 font-sans">
                            {t.sizeLabel}
                          </span>
                          <span className="text-slate-200">
                            {formatBytes(inspectedEntry.sizeBytes)} (
                            {inspectedEntry.sizeBytes.toLocaleString()} B)
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400 font-sans">
                            {t.sectorLbaLabel}
                          </span>
                          <span className="text-slate-200">
                            {inspectedEntry.startSector} (
                            {Math.ceil(inspectedEntry.sizeBytes / SECTOR_SIZE)}{' '}
                            {t.sectorsUnit})
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400 font-sans">
                            {t.byteOffsetLabel}
                          </span>
                          <span className="text-emerald-400">
                            0x
                            {(
                              (inspectedEntry.partitionOffset ?? 0) +
                              inspectedEntry.startSector * SECTOR_SIZE
                            )
                              .toString(16)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400 font-sans">
                            {t.attributesLabel}
                          </span>
                          <span className="text-slate-200">
                            0x
                            {inspectedEntry.attributes
                              .toString(16)
                              .toUpperCase()
                              .padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExtractSingleFile(inspectedEntry)}
                        disabled={isBusy}
                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#107C10] hover:bg-[#159615] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {t.exportFileButton} {inspectedEntry.name}
                        </span>
                      </button>
                    </aside>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODE 2: CREATE NEW XISO FROM FOLDER / FILES (-c) */}
        {mode === 'create' && (
          <section className="rounded-2xl bg-[#111827] border border-slate-800 p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white font-display">
                  {t.createHeader}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {t.createSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => createFolderInputRef.current?.click()}
                  disabled={isBusy}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-emerald-400" />
                  <span>{t.addFolderButton}</span>
                </button>
                <button
                  type="button"
                  onClick={() => createFilesInputRef.current?.click()}
                  disabled={isBusy}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>{t.addFilesButton}</span>
                </button>
                {createItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreateItems([])}
                    disabled={isBusy}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-red-950/50 text-slate-400 hover:text-red-300 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.clearButton}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Output ISO Configuration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">
                  {t.outputIsoNameLabel}
                </label>
                <input
                  type="text"
                  value={outputIsoName}
                  onChange={(e) => setOutputIsoName(e.target.value)}
                  placeholder="game.iso"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div className="sm:col-span-3 pt-4 sm:pt-5">
                <label className="min-h-[42px] px-3 py-2 rounded-xl bg-[#090D16] border border-slate-800 flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createPatchXbe}
                    onChange={(e) => setCreatePatchXbe(e.target.checked)}
                    className="w-4 h-4 accent-[#107C10] rounded"
                  />
                  <span>{t.patchXbeLabel}</span>
                </label>
              </div>

              <div className="sm:col-span-3 pt-2 sm:pt-5">
                <button
                  type="button"
                  onClick={handleBuildNewXiso}
                  disabled={createItems.length === 0 || isBusy}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#107C10] hover:bg-[#159615] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>{t.generateExportIsoButton}</span>
                </button>
              </div>
            </div>

            {/* File Queue List */}
            {createItems.length === 0 ? (
              <div
                onClick={() => createFolderInputRef.current?.click()}
                className="min-h-[240px] rounded-xl border border-dashed border-slate-800 bg-[#090D16]/60 hover:border-slate-700 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
              >
                <FolderPlus className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-300">
                  {t.emptyCreateTitle}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.emptyCreateSubtitle}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-[#090D16] border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                  <span>
                    {createItems.length} {t.includedFilesCount}
                  </span>
                  <span>
                    {t.totalDataLabel}: {formatBytes(totalCreateBytes)}
                  </span>
                </div>
                <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
                  {createItems.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-800/30"
                    >
                      <span className="font-mono text-slate-200 truncate">
                        {item.relativePath}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono tabular-nums text-slate-400">
                          {formatBytes(item.sizeBytes)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCreateItems((prev) =>
                              prev.filter((x) => x.id !== item.id)
                            )
                          }
                          className="text-slate-500 hover:text-red-400 p-1"
                          aria-label={item.relativePath}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
