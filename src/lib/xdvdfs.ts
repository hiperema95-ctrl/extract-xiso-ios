/**
 * Genuine XDVDFS (Xbox & Xbox 360 DVD File System) Binary Engine
 * Implements the exact specification from xboxdev/extract-xiso:
 * - Volume Descriptor at Sector 32 (offset 0x10000 from game partition start)
 * - Magic signature "MICROSOFT*XBOX*MEDIA" at 0x00 and 0x7EC (20 bytes each)
 * - Full support for Trimmed XISO (0x0), Original Xbox XGD1 Redump (0x18300000),
 *   Xbox 360 XGD2 Redump (0x0FD90000), Wave 1/2 (0x06060000), and XGD3 (0x02080000)
 * - Binary search tree directory records (left/right uint16 word offsets)
 * - 64-bit byte addressing (Number safe up to 9 PB) for 4.7GB - 8.5GB Xbox ISOs
 * - XBE (Original Xbox) & XEX2 (Xbox 360) executable detection
 */

export const SECTOR_SIZE = 2048;
export const VOLUME_DESCRIPTOR_SECTOR = 32;
export const VOLUME_DESCRIPTOR_OFFSET = VOLUME_DESCRIPTOR_SECTOR * SECTOR_SIZE; // 0x10000 (65536)
export const XBOX_MEDIA_MAGIC = 'MICROSOFT*XBOX*MEDIA';

// Exact Xbox & Xbox 360 game partition base offsets (where Volume Descriptor sits at offset + 0x10000)
export const KNOWN_PARTITION_OFFSETS = [
  { label: 'Standard XISO (0x00000000)', offset: 0x00000000 },
  { label: 'Xbox 360 XGD2 Redump (0x0FD90000)', offset: 0x0fd90000 },
  { label: 'Xbox 360 XGD3 Redump (0x02080000)', offset: 0x02080000 },
  { label: 'Original Xbox XGD1 Redump (0x18300000)', offset: 0x18300000 },
  { label: 'Xbox 360 XGD2 Wave 1/2 (0x06060000)', offset: 0x06060000 },
  { label: 'Xbox 360 XGD3 Alt (0x02060000)', offset: 0x02060000 },
  { label: 'Original Xbox Alt (0x18310000)', offset: 0x18310000 },
  { label: 'Xbox 360 XGD2 Alt (0x0FDA0000)', offset: 0x0fda0000 },
];

export const XDVDFS_ATTR_READONLY = 0x01;
export const XDVDFS_ATTR_HIDDEN = 0x02;
export const XDVDFS_ATTR_SYSTEM = 0x04;
export const XDVDFS_ATTR_DIRECTORY = 0x10;
export const XDVDFS_ATTR_ARCHIVE = 0x20;
export const XDVDFS_ATTR_NORMAL = 0x80;

export interface XbeMetadata {
  titleName: string;
  titleIdHex: string;
  allowedMediaFlags: number;
  gameRegion: number;
  isPatched: boolean;
  platform: 'Xbox' | 'Xbox 360';
}

export interface XDVDFSEntry {
  id: string;
  name: string;
  path: string; // e.g. "/default.xbe" or "/default.xex"
  parentPath: string;
  isDirectory: boolean;
  startSector: number;
  sizeBytes: number;
  attributes: number;
  children?: XDVDFSEntry[];
  sourceFile?: File | Blob;
  partitionOffset?: number;
}

export interface XDVDFSVolume {
  fileName: string;
  fileSize: number;
  partitionOffset: number;
  partitionTypeLabel: string;
  rootDirSector: number;
  rootDirSize: number;
  volumeTimestamp: Date | null;
  totalFiles: number;
  totalDirectories: number;
  totalDataBytes: number;
  xbeMetadata: XbeMetadata | null;
  rootEntries: XDVDFSEntry[];
  flatEntries: XDVDFSEntry[];
  sourceFile: File;
}

export interface ExtractionProgress {
  phase: 'reading' | 'extracting' | 'packing' | 'rewriting' | 'done';
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  processedBytes: number;
  totalBytes: number;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const code = bytes[offset + i];
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function checkMagicAtSector(sectorBytes: Uint8Array): boolean {
  if (sectorBytes.byteLength < SECTOR_SIZE) return false;
  const headMagic = readAscii(sectorBytes, 0, 20);
  const tailMagic = readAscii(sectorBytes, 0x7ec, 20);
  return headMagic === XBOX_MEDIA_MAGIC && tailMagic === XBOX_MEDIA_MAGIC;
}

function filetimeToDate(low: number, high: number): Date | null {
  if (low === 0 && high === 0) return null;
  const filetime = high * 4294967296 + low;
  const unixMs = filetime / 10000 - 11644473600000;
  if (unixMs < 0 || unixMs > 4102444800000) return null;
  return new Date(unixMs);
}

/**
 * Parses Original Xbox (.xbe) or Xbox 360 (.xex) header in root directory
 */
export async function parseExecutableHeader(
  isoFile: File | Blob,
  partitionOffset: number,
  execEntry: XDVDFSEntry
): Promise<XbeMetadata | null> {
  try {
    const byteOffset = partitionOffset + execEntry.startSector * SECTOR_SIZE;
    const readLen = Math.min(execEntry.sizeBytes, 65536);
    if (readLen < 0x100) return null;

    const slice = isoFile.slice(byteOffset, byteOffset + readLen);
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    const magic = readAscii(bytes, 0, 4);

    // Original Xbox Executable (XBEH)
    if (magic === 'XBEH' && readLen >= 0x200) {
      const baseAddress = view.getUint32(0x104, true);
      const certAddress = view.getUint32(0x118, true);
      const certOffset = certAddress - baseAddress;

      if (certOffset < 0 || certOffset + 0xb0 > buf.byteLength) {
        return null;
      }

      const titleId = view.getUint32(certOffset + 0x08, true);
      const titleIdHex = titleId.toString(16).toUpperCase().padStart(8, '0');

      let titleName = '';
      for (let i = 0; i < 40; i++) {
        const charCode = view.getUint16(certOffset + 0x0c + i * 2, true);
        if (charCode === 0) break;
        titleName += String.fromCharCode(charCode);
      }

      const allowedMediaFlags = view.getUint32(certOffset + 0x9c, true);
      const gameRegion = view.getUint32(certOffset + 0xa0, true);
      const isPatched = (allowedMediaFlags & 0x00ffffff) === 0x00ffffff;

      return {
        titleName: titleName.trim() || 'Xbox Game',
        titleIdHex,
        allowedMediaFlags,
        gameRegion,
        isPatched,
        platform: 'Xbox',
      };
    }

    // Xbox 360 Executable (XEX2 - Big Endian header)
    if (magic === 'XEX2' && readLen >= 24) {
      const headerDirOffset = view.getUint32(0x10, false);
      const headerCount = view.getUint32(0x14, false);
      let titleIdHex = 'XBOX360';

      if (24 + headerCount * 8 <= buf.byteLength) {
        for (let i = 0; i < headerCount; i++) {
          const key = view.getUint32(24 + i * 8, false);
          const valOffset = view.getUint32(24 + i * 8 + 4, false);
          // 0x00040006 is Execution ID header in XEX2
          if (key === 0x00040006 && valOffset + 16 <= buf.byteLength) {
            const tid = view.getUint32(valOffset + 12, false);
            if (tid !== 0) {
              titleIdHex = tid.toString(16).toUpperCase().padStart(8, '0');
            }
            break;
          }
        }
      }
      void headerDirOffset;

      return {
        titleName: '',
        titleIdHex,
        allowedMediaFlags: 0,
        gameRegion: 0,
        isPatched: false,
        platform: 'Xbox 360',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Patches an Original Xbox .xbe binary buffer in-place so it can boot from any media
 */
export function patchXbeBuffer(buffer: Uint8Array): boolean {
  if (buffer.byteLength < 0x200) return false;
  const magic = readAscii(buffer, 0, 4);
  if (magic !== 'XBEH') return false;

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const baseAddress = view.getUint32(0x104, true);
  const certAddress = view.getUint32(0x118, true);
  const certOffset = certAddress - baseAddress;

  if (certOffset < 0 || certOffset + 0xa4 > buffer.byteLength) return false;

  const currentMedia = view.getUint32(certOffset + 0x9c, true);
  const patchedMedia = (currentMedia | 0x00ffffff) >>> 0;
  view.setUint32(certOffset + 0x9c, patchedMedia, true);

  const currentRegion = view.getUint32(certOffset + 0xa0, true);
  view.setUint32(certOffset + 0xa0, (currentRegion | 0x80000007) >>> 0, true);

  return true;
}

/**
 * Parses an Xbox / Xbox 360 ISO (.iso / .xiso) file using chunked Blob slices.
 */
export async function parseXISOFile(file: File): Promise<XDVDFSVolume> {
  let detectedPartitionOffset = -1;
  let detectedPartitionLabel = '';
  let vdBuffer: ArrayBuffer | null = null;

  // 1. Check all known Xbox & Xbox 360 partition base offsets (at candidate + 0x10000)
  for (const candidate of KNOWN_PARTITION_OFFSETS) {
    const targetOffset = candidate.offset + VOLUME_DESCRIPTOR_OFFSET;
    if (targetOffset + SECTOR_SIZE <= file.size) {
      const slice = file.slice(targetOffset, targetOffset + SECTOR_SIZE);
      const buf = await slice.arrayBuffer();
      if (checkMagicAtSector(new Uint8Array(buf))) {
        detectedPartitionOffset = candidate.offset;
        detectedPartitionLabel = candidate.label;
        vdBuffer = buf;
        break;
      }
    }
    // Also check if candidate itself is the Volume Descriptor offset
    if (
      candidate.offset >= VOLUME_DESCRIPTOR_OFFSET &&
      candidate.offset + SECTOR_SIZE <= file.size
    ) {
      const slice = file.slice(candidate.offset, candidate.offset + SECTOR_SIZE);
      const buf = await slice.arrayBuffer();
      if (checkMagicAtSector(new Uint8Array(buf))) {
        detectedPartitionOffset = candidate.offset - VOLUME_DESCRIPTOR_OFFSET;
        detectedPartitionLabel = candidate.label;
        vdBuffer = buf;
        break;
      }
    }
  }

  // 2. Fast fallback scan across the first 600 MB at 64 KB (0x10000) boundaries,
  //    then fine 2048-byte sector scan in the first 16 MB for non-standard headers.
  if (detectedPartitionOffset === -1) {
    const maxCoarseScan = Math.min(file.size - SECTOR_SIZE, 600 * 1024 * 1024);
    const step = 0x10000; // 64 KB
    const batchSpan = 8 * 1024 * 1024; // Read 8 MB windows

    for (let base = 0; base < maxCoarseScan; base += batchSpan) {
      const len = Math.min(batchSpan + SECTOR_SIZE, file.size - base);
      const buf = await file.slice(base, base + len).arrayBuffer();
      const bytes = new Uint8Array(buf);

      for (let pos = 0; pos <= bytes.byteLength - SECTOR_SIZE; pos += step) {
        if (
          bytes[pos] === 0x4d &&
          bytes[pos + 1] === 0x49 &&
          checkMagicAtSector(bytes.subarray(pos, pos + SECTOR_SIZE))
        ) {
          const foundVdOffset = base + pos;
          if (foundVdOffset >= VOLUME_DESCRIPTOR_OFFSET) {
            detectedPartitionOffset = foundVdOffset - VOLUME_DESCRIPTOR_OFFSET;
            detectedPartitionLabel = `Partizione Rilevata (0x${detectedPartitionOffset
              .toString(16)
              .toUpperCase()})`;
            vdBuffer = bytes.slice(pos, pos + SECTOR_SIZE).buffer;
            break;
          }
        }
      }
      if (detectedPartitionOffset !== -1) break;
    }
  }

  // 3. Fine 2048-byte sector scan across first 16 MB if still not found
  if (detectedPartitionOffset === -1) {
    const maxFineScan = Math.min(file.size - SECTOR_SIZE, 16 * 1024 * 1024);
    const buf = await file.slice(0, maxFineScan).arrayBuffer();
    const bytes = new Uint8Array(buf);
    for (let pos = VOLUME_DESCRIPTOR_OFFSET; pos <= bytes.byteLength - SECTOR_SIZE; pos += SECTOR_SIZE) {
      if (
        bytes[pos] === 0x4d &&
        bytes[pos + 1] === 0x49 &&
        checkMagicAtSector(bytes.subarray(pos, pos + SECTOR_SIZE))
      ) {
        detectedPartitionOffset = pos - VOLUME_DESCRIPTOR_OFFSET;
        detectedPartitionLabel = `Offset Custom (0x${detectedPartitionOffset
          .toString(16)
          .toUpperCase()})`;
        vdBuffer = bytes.slice(pos, pos + SECTOR_SIZE).buffer;
        break;
      }
    }
  }

  if (detectedPartitionOffset === -1 || !vdBuffer) {
    throw new Error(
      'Firma XDVDFS "MICROSOFT*XBOX*MEDIA" non trovata. Verifica che il file sia un\'immagine disco Xbox o Xbox 360 (.iso / .xiso) non crittografata.'
    );
  }

  const vdView = new DataView(vdBuffer);
  const rootDirSector = vdView.getUint32(0x14, true);
  const rootDirSize = vdView.getUint32(0x18, true);
  const ftLow = vdView.getUint32(0x1c, true);
  const ftHigh = vdView.getUint32(0x20, true);
  const volumeTimestamp = filetimeToDate(ftLow, ftHigh);

  const flatEntries: XDVDFSEntry[] = [];
  let totalFiles = 0;
  let totalDirectories = 0;
  let totalDataBytes = 0;

  async function parseDirectoryTable(
    dirSector: number,
    dirSize: number,
    parentPath: string
  ): Promise<XDVDFSEntry[]> {
    if (dirSector === 0 || dirSize === 0) return [];
    const byteOffset = detectedPartitionOffset + dirSector * SECTOR_SIZE;
    if (byteOffset + dirSize > file.size) return [];

    const tableBuf = await file.slice(byteOffset, byteOffset + dirSize).arrayBuffer();
    const view = new DataView(tableBuf);
    const bytes = new Uint8Array(tableBuf);

    const entries: XDVDFSEntry[] = [];
    const visitedOffsets = new Set<number>();
    const stack: number[] = [0];

    while (stack.length > 0) {
      const nodeOffset = stack.pop()!;
      if (nodeOffset < 0 || nodeOffset + 14 > dirSize) continue;
      if (visitedOffsets.has(nodeOffset)) continue;
      visitedOffsets.add(nodeOffset);

      const leftOffsetWords = view.getUint16(nodeOffset + 0, true);
      const rightOffsetWords = view.getUint16(nodeOffset + 2, true);
      const startSector = view.getUint32(nodeOffset + 4, true);
      const fileSize = view.getUint32(nodeOffset + 8, true);
      const attributes = view.getUint8(nodeOffset + 12);
      const nameLength = view.getUint8(nodeOffset + 13);

      if (
        leftOffsetWords === 0xffff &&
        rightOffsetWords === 0xffff &&
        startSector === 0xffffffff
      ) {
        continue;
      }

      if (nameLength === 0 || nodeOffset + 14 + nameLength > dirSize) {
        continue;
      }

      if (rightOffsetWords !== 0 && rightOffsetWords !== 0xffff) {
        stack.push(rightOffsetWords * 4);
      }
      if (leftOffsetWords !== 0 && leftOffsetWords !== 0xffff) {
        stack.push(leftOffsetWords * 4);
      }

      const rawName = new TextDecoder('utf-8', { fatal: false }).decode(
        bytes.subarray(nodeOffset + 14, nodeOffset + 14 + nameLength)
      );
      const cleanName = rawName.replace(/\0/g, '').trim();
      if (!cleanName || cleanName === '.' || cleanName === '..') continue;

      const isDirectory = (attributes & XDVDFS_ATTR_DIRECTORY) !== 0;
      const fullPath = parentPath === '/' ? `/${cleanName}` : `${parentPath}/${cleanName}`;

      const entry: XDVDFSEntry = {
        id: `${fullPath}:${startSector}`,
        name: cleanName,
        path: fullPath,
        parentPath,
        isDirectory,
        startSector,
        sizeBytes: fileSize,
        attributes,
        sourceFile: file,
        partitionOffset: detectedPartitionOffset,
      };

      entries.push(entry);
      flatEntries.push(entry);

      if (isDirectory) {
        totalDirectories++;
      } else {
        totalFiles++;
        totalDataBytes += fileSize;
      }
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    for (const entry of entries) {
      if (entry.isDirectory && entry.startSector > 0 && entry.sizeBytes > 0) {
        entry.children = await parseDirectoryTable(
          entry.startSector,
          entry.sizeBytes,
          entry.path
        );
      }
    }

    return entries;
  }

  const rootEntries = await parseDirectoryTable(rootDirSector, rootDirSize, '/');

  // Check for default.xbe (Original Xbox) or default.xex (Xbox 360) in root
  let xbeMetadata: XbeMetadata | null = null;
  const rootExec = rootEntries.find(
    (e) =>
      !e.isDirectory &&
      (e.name.toLowerCase() === 'default.xbe' ||
        e.name.toLowerCase() === 'default.xex')
  );
  if (rootExec) {
    xbeMetadata = await parseExecutableHeader(
      file,
      detectedPartitionOffset,
      rootExec
    );
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    partitionOffset: detectedPartitionOffset,
    partitionTypeLabel: detectedPartitionLabel,
    rootDirSector,
    rootDirSize,
    volumeTimestamp,
    totalFiles,
    totalDirectories,
    totalDataBytes,
    xbeMetadata,
    rootEntries,
    flatEntries,
    sourceFile: file,
  };
}

/**
 * Extracts a single file's binary Blob from the XISO image.
 */
export async function extractSingleFileBlob(
  entry: XDVDFSEntry,
  patchXbe: boolean = true
): Promise<Blob> {
  if (!entry.sourceFile) {
    throw new Error('File sorgente non disponibile per questa voce.');
  }
  const partOffset = entry.partitionOffset ?? 0;
  const startByte = partOffset + entry.startSector * SECTOR_SIZE;
  const endByte = startByte + entry.sizeBytes;
  const rawSlice = entry.sourceFile.slice(startByte, endByte);

  if (patchXbe && entry.name.toLowerCase().endsWith('.xbe') && entry.sizeBytes >= 0x200) {
    const headerLen = Math.min(entry.sizeBytes, 32768);
    const headerBuf = new Uint8Array(await rawSlice.slice(0, headerLen).arrayBuffer());
    patchXbeBuffer(headerBuf);
    if (entry.sizeBytes > headerLen) {
      return new Blob([headerBuf, rawSlice.slice(headerLen)], {
        type: 'application/octet-stream',
      });
    }
    return new Blob([headerBuf], { type: 'application/octet-stream' });
  }

  return rawSlice;
}

export interface BuildXISOInputItem {
  path: string;
  isDirectory: boolean;
  dataBlob?: Blob;
  sizeBytes: number;
}

interface InternalTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  dataBlob?: Blob;
  sizeBytes: number;
  children: Map<string, InternalTreeNode>;
  dirTableBuffer?: Uint8Array;
  allocatedSector: number;
  allocatedByteSize: number;
  recordOffsetInTable: number;
  leftChildIndex: number;
  rightChildIndex: number;
}

export async function buildXISOImageBlob(
  items: BuildXISOInputItem[],
  options: {
    patchXbe: boolean;
    onProgress?: (progress: ExtractionProgress) => void;
  }
): Promise<Blob> {
  const root: InternalTreeNode = {
    name: '',
    path: '/',
    isDirectory: true,
    sizeBytes: 0,
    children: new Map(),
    allocatedSector: 0,
    allocatedByteSize: 0,
    recordOffsetInTable: 0,
    leftChildIndex: -1,
    rightChildIndex: -1,
  };

  for (const item of items) {
    const cleanPath = item.path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanPath) continue;
    const segments = cleanPath.split('/');
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const isDir = isLast ? item.isDirectory : true;
      const nodePath =
        current.path === '/' ? `/${seg}` : `${current.path}/${seg}`;

      let existing = current.children.get(seg.toUpperCase());
      if (!existing) {
        existing = {
          name: seg,
          path: nodePath,
          isDirectory: isDir,
          dataBlob: isLast ? item.dataBlob : undefined,
          sizeBytes: isLast && !isDir ? item.sizeBytes : 0,
          children: new Map(),
          allocatedSector: 0,
          allocatedByteSize: 0,
          recordOffsetInTable: 0,
          leftChildIndex: -1,
          rightChildIndex: -1,
        };
        current.children.set(seg.toUpperCase(), existing);
      } else if (isLast && !isDir) {
        existing.isDirectory = false;
        existing.dataBlob = item.dataBlob;
        existing.sizeBytes = item.sizeBytes;
      }
      current = existing;
    }
  }

  const allDirs: InternalTreeNode[] = [];
  const allFiles: InternalTreeNode[] = [];

  function collectNodes(dirNode: InternalTreeNode) {
    allDirs.push(dirNode);
    const sortedKeys = Array.from(dirNode.children.keys()).sort();
    for (const key of sortedKeys) {
      const child = dirNode.children.get(key)!;
      if (child.isDirectory) {
        collectNodes(child);
      } else {
        allFiles.push(child);
      }
    }
  }
  collectNodes(root);

  function computeDirTableMetrics(dirNode: InternalTreeNode): number {
    const sortedKeys = Array.from(dirNode.children.keys()).sort();
    if (sortedKeys.length === 0) {
      return SECTOR_SIZE;
    }

    const orderedChildren = sortedKeys.map((k) => dirNode.children.get(k)!);

    function buildBST(start: number, end: number): number {
      if (start > end) return -1;
      const mid = (start + end) >> 1;
      orderedChildren[mid].leftChildIndex = buildBST(start, mid - 1);
      orderedChildren[mid].rightChildIndex = buildBST(mid + 1, end);
      return mid;
    }
    const bstRootIdx = buildBST(0, orderedChildren.length - 1);

    const placementOrder: InternalTreeNode[] = [];
    const visited = new Set<number>();

    function pushPreOrder(idx: number) {
      if (idx < 0 || visited.has(idx)) return;
      visited.add(idx);
      placementOrder.push(orderedChildren[idx]);
      pushPreOrder(orderedChildren[idx].leftChildIndex);
      pushPreOrder(orderedChildren[idx].rightChildIndex);
    }
    pushPreOrder(bstRootIdx);

    let currentOffset = 0;
    for (const child of placementOrder) {
      const nameBytes = new TextEncoder().encode(child.name);
      const rawLen = 14 + nameBytes.byteLength;
      const alignedLen = (rawLen + 3) & ~3;

      const offsetInSector = currentOffset % SECTOR_SIZE;
      if (offsetInSector + alignedLen > SECTOR_SIZE) {
        currentOffset += SECTOR_SIZE - offsetInSector;
      }

      child.recordOffsetInTable = currentOffset;
      currentOffset += alignedLen;
    }

    const totalSectors = Math.max(1, Math.ceil(currentOffset / SECTOR_SIZE));
    return totalSectors * SECTOR_SIZE;
  }

  let nextSector = 33;

  for (const dir of allDirs) {
    const tableByteSize = computeDirTableMetrics(dir);
    dir.allocatedSector = nextSector;
    dir.allocatedByteSize = tableByteSize;
    nextSector += tableByteSize / SECTOR_SIZE;
  }

  for (const fileNode of allFiles) {
    if (fileNode.sizeBytes > 0) {
      fileNode.allocatedSector = nextSector;
      fileNode.allocatedByteSize = fileNode.sizeBytes;
      const sectorsNeeded = Math.ceil(fileNode.sizeBytes / SECTOR_SIZE);
      nextSector += sectorsNeeded;
    } else {
      fileNode.allocatedSector = 0;
      fileNode.allocatedByteSize = 0;
    }
  }

  for (const dir of allDirs) {
    const buf = new Uint8Array(dir.allocatedByteSize);
    buf.fill(0xff);
    const view = new DataView(buf.buffer);

    const sortedKeys = Array.from(dir.children.keys()).sort();
    const orderedChildren = sortedKeys.map((k) => dir.children.get(k)!);

    for (const child of orderedChildren) {
      const pos = child.recordOffsetInTable;
      const leftNode =
        child.leftChildIndex >= 0 ? orderedChildren[child.leftChildIndex] : null;
      const rightNode =
        child.rightChildIndex >= 0 ? orderedChildren[child.rightChildIndex] : null;

      const leftWords = leftNode ? leftNode.recordOffsetInTable / 4 : 0;
      const rightWords = rightNode ? rightNode.recordOffsetInTable / 4 : 0;

      view.setUint16(pos + 0, leftWords, true);
      view.setUint16(pos + 2, rightWords, true);
      view.setUint32(pos + 4, child.allocatedSector, true);
      view.setUint32(pos + 8, child.allocatedByteSize, true);
      view.setUint8(
        pos + 12,
        child.isDirectory ? XDVDFS_ATTR_DIRECTORY : XDVDFS_ATTR_NORMAL
      );

      const nameBytes = new TextEncoder().encode(child.name);
      const clampedLen = Math.min(255, nameBytes.byteLength);
      view.setUint8(pos + 13, clampedLen);
      buf.set(nameBytes.subarray(0, clampedLen), pos + 14);

      const rawEnd = pos + 14 + clampedLen;
      const alignedEnd = (rawEnd + 3) & ~3;
      for (let p = rawEnd; p < alignedEnd; p++) {
        buf[p] = 0x00;
      }
    }

    dir.dirTableBuffer = buf;
  }

  const blobParts: BlobPart[] = [];
  blobParts.push(new Uint8Array(VOLUME_DESCRIPTOR_OFFSET));

  const vd = new Uint8Array(SECTOR_SIZE);
  const vdView = new DataView(vd.buffer);
  const magicBytes = new TextEncoder().encode(XBOX_MEDIA_MAGIC);
  vd.set(magicBytes, 0x00);
  vdView.setUint32(0x14, root.allocatedSector, true);
  vdView.setUint32(0x18, root.allocatedByteSize, true);

  const nowFiletime = BigInt(Date.now() + 11644473600000) * 10000n;
  vdView.setUint32(0x1c, Number(nowFiletime & 0xffffffffn), true);
  vdView.setUint32(0x20, Number((nowFiletime >> 32n) & 0xffffffffn), true);
  vd.set(magicBytes, 0x7ec);
  blobParts.push(vd);

  for (const dir of allDirs) {
    if (dir.dirTableBuffer) {
      blobParts.push(dir.dirTableBuffer as unknown as BlobPart);
    }
  }

  const totalBytes = allFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
  let processedBytes = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const fileNode = allFiles[i];
    if (options.onProgress) {
      options.onProgress({
        phase: 'rewriting',
        currentFile: fileNode.path,
        processedFiles: i + 1,
        totalFiles: allFiles.length,
        processedBytes,
        totalBytes,
      });
    }

    if (fileNode.sizeBytes > 0 && fileNode.dataBlob) {
      let payloadBlob = fileNode.dataBlob.slice(0, fileNode.sizeBytes);

      if (
        options.patchXbe &&
        fileNode.name.toLowerCase().endsWith('.xbe') &&
        fileNode.sizeBytes >= 0x200
      ) {
        const headerLen = Math.min(fileNode.sizeBytes, 32768);
        const headerArr = new Uint8Array(
          await payloadBlob.slice(0, headerLen).arrayBuffer()
        );
        patchXbeBuffer(headerArr);
        payloadBlob =
          fileNode.sizeBytes > headerLen
            ? new Blob([headerArr, payloadBlob.slice(headerLen)])
            : new Blob([headerArr]);
      }

      blobParts.push(payloadBlob);

      const remainder = fileNode.sizeBytes % SECTOR_SIZE;
      if (remainder !== 0) {
        blobParts.push(new Uint8Array(SECTOR_SIZE - remainder));
      }
      processedBytes += fileNode.sizeBytes;
    }
  }

  const remainderSectors = nextSector % 32;
  if (remainderSectors !== 0) {
    blobParts.push(new Uint8Array((32 - remainderSectors) * SECTOR_SIZE));
  }

  return new Blob(blobParts, { type: 'application/octet-stream' });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : i >= 2 ? 2 : 1)} ${sizes[i]}`;
}
