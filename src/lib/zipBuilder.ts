/**
 * Fast Streaming ZIP / ZIP64 Builder (STORE Mode / Zero-Compression Copy)
 * Supports archives > 4 GB via ZIP64 extensions so full 7.8 GB Xbox 360 (XGD2/XGD3)
 * and Original Xbox extractions never overflow 32-bit offsets.
 */

import {
  ExtractionProgress,
  extractSingleFileBlob,
  XDVDFSEntry,
} from './xdvdfs';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

async function computeBlobCrc32(blob: Blob): Promise<number> {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks for high throughput
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
    const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size));
    const buf = new Uint8Array(await slice.arrayBuffer());
    for (let i = 0; i < buf.byteLength; i++) {
      crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function setUint64LE(view: DataView, byteOffset: number, value: number) {
  const big = BigInt(Math.floor(value));
  view.setUint32(byteOffset, Number(big & 0xffffffffn), true);
  view.setUint32(byteOffset + 4, Number((big >> 32n) & 0xffffffffn), true);
}

export async function createZipFromEntries(
  entries: XDVDFSEntry[],
  options: {
    patchXbe: boolean;
    basePathStrip?: string;
    onProgress?: (progress: ExtractionProgress) => void;
    signal?: AbortSignal;
  }
): Promise<Blob> {
  const fileList: XDVDFSEntry[] = [];
  const seenIds = new Set<string>();

  function collectFiles(items: XDVDFSEntry[]) {
    for (const item of items) {
      if (item.isDirectory) {
        if (item.children) collectFiles(item.children);
      } else if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        fileList.push(item);
      }
    }
  }
  collectFiles(entries);

  const totalBytes = fileList.reduce((acc, f) => acc + f.sizeBytes, 0);
  let processedBytes = 0;

  const zipParts: BlobPart[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let currentOffset = 0;
  let usedZip64 = false;

  const encoder = new TextEncoder();

  for (let idx = 0; idx < fileList.length; idx++) {
    if (options.signal?.aborted) {
      throw new Error('Estrazione annullata.');
    }

    const entry = fileList[idx];
    if (options.onProgress) {
      options.onProgress({
        phase: 'extracting',
        currentFile: entry.path,
        processedFiles: idx + 1,
        totalFiles: fileList.length,
        processedBytes,
        totalBytes,
      });
    }

    const fileBlob = await extractSingleFileBlob(entry, options.patchXbe);
    const crc32 = await computeBlobCrc32(fileBlob);
    const fileSize = fileBlob.size;

    let relPath = entry.path.replace(/^\/+/, '');
    if (options.basePathStrip) {
      const strip = options.basePathStrip.replace(/^\/+/, '').replace(/\/+$/, '');
      if (strip && relPath.startsWith(strip + '/')) {
        relPath = relPath.slice(strip.length + 1);
      }
    }

    const nameBytes = encoder.encode(relPath);
    const needsZip64Offset = currentOffset >= 0xffffffff;
    const needsZip64Size = fileSize >= 0xffffffff;
    const entryZip64 = needsZip64Offset || needsZip64Size;
    if (entryZip64) usedZip64 = true;

    // Local File Header (30 + nameLen bytes)
    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const lhView = new DataView(localHeader.buffer);
    lhView.setUint32(0, 0x04034b50, true);
    lhView.setUint16(4, entryZip64 ? 45 : 20, true);
    lhView.setUint16(6, 0x0800, true);
    lhView.setUint16(8, 0, true); // STORE
    lhView.setUint16(10, 0, true);
    lhView.setUint16(12, 0x2100, true);
    lhView.setUint32(14, crc32, true);
    lhView.setUint32(18, needsZip64Size ? 0xffffffff : fileSize, true);
    lhView.setUint32(22, needsZip64Size ? 0xffffffff : fileSize, true);
    lhView.setUint16(26, nameBytes.byteLength, true);
    lhView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    zipParts.push(localHeader);
    zipParts.push(fileBlob);

    // Central Directory Header (46 + nameLen + optional ZIP64 extra field)
    const extraLen = entryZip64 ? 4 + (needsZip64Size ? 16 : 0) + (needsZip64Offset ? 8 : 0) : 0;
    const cdHeader = new Uint8Array(46 + nameBytes.byteLength + extraLen);
    const cdView = new DataView(cdHeader.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, entryZip64 ? 45 : 20, true);
    cdView.setUint16(6, entryZip64 ? 45 : 20, true);
    cdView.setUint16(8, 0x0800, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0x2100, true);
    cdView.setUint32(16, crc32, true);
    cdView.setUint32(20, needsZip64Size ? 0xffffffff : fileSize, true);
    cdView.setUint32(24, needsZip64Size ? 0xffffffff : fileSize, true);
    cdView.setUint16(28, nameBytes.byteLength, true);
    cdView.setUint16(30, extraLen, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, needsZip64Offset ? 0xffffffff : currentOffset, true);
    cdHeader.set(nameBytes, 46);

    if (entryZip64) {
      let extraPos = 46 + nameBytes.byteLength;
      cdView.setUint16(extraPos, 0x0001, true); // ZIP64 Extra Field Tag
      cdView.setUint16(extraPos + 2, extraLen - 4, true);
      extraPos += 4;
      if (needsZip64Size) {
        setUint64LE(cdView, extraPos, fileSize);
        setUint64LE(cdView, extraPos + 8, fileSize);
        extraPos += 16;
      }
      if (needsZip64Offset) {
        setUint64LE(cdView, extraPos, currentOffset);
      }
    }

    centralDirectoryParts.push(cdHeader);

    currentOffset += localHeader.byteLength + fileSize;
    processedBytes += fileSize;
  }

  const cdStartOffset = currentOffset;
  let cdSize = 0;
  for (const cd of centralDirectoryParts) {
    zipParts.push(cd as unknown as BlobPart);
    cdSize += cd.byteLength;
  }

  if (usedZip64 || cdStartOffset >= 0xffffffff || fileList.length >= 0xffff) {
    // ZIP64 End of Central Directory Record (56 bytes)
    const zip64EocdOffset = cdStartOffset + cdSize;
    const zip64Eocd = new Uint8Array(56);
    const z64View = new DataView(zip64Eocd.buffer);
    z64View.setUint32(0, 0x06064b50, true);
    setUint64LE(z64View, 4, 44);
    z64View.setUint16(12, 45, true);
    z64View.setUint16(14, 45, true);
    z64View.setUint32(16, 0, true);
    z64View.setUint32(20, 0, true);
    setUint64LE(z64View, 24, fileList.length);
    setUint64LE(z64View, 32, fileList.length);
    setUint64LE(z64View, 40, cdSize);
    setUint64LE(z64View, 48, cdStartOffset);
    zipParts.push(zip64Eocd);

    // ZIP64 End of Central Directory Locator (20 bytes)
    const zip64Locator = new Uint8Array(20);
    const locView = new DataView(zip64Locator.buffer);
    locView.setUint32(0, 0x07064b50, true);
    locView.setUint32(4, 0, true);
    setUint64LE(locView, 8, zip64EocdOffset);
    locView.setUint32(16, 1, true);
    zipParts.push(zip64Locator);
  }

  // Standard End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, Math.min(0xffff, fileList.length), true);
  eocdView.setUint16(10, Math.min(0xffff, fileList.length), true);
  eocdView.setUint32(12, Math.min(0xffffffff, cdSize), true);
  eocdView.setUint32(16, Math.min(0xffffffff, cdStartOffset), true);
  eocdView.setUint16(20, 0, true);
  zipParts.push(eocd);

  return new Blob(zipParts, { type: 'application/zip' });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
