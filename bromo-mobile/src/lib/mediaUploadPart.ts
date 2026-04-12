import {Platform} from 'react-native';

/** Build RN FormData file part for /media/upload — preserves real extension when possible (no fake .mp4 for MOV). */

const KNOWN_IMAGE_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
]);
const KNOWN_VIDEO_EXT = new Set(['mp4', 'mov', 'm4v', '3gp', 'webm', 'mkv', 'avi', 'mpeg', 'mpg']);
const KNOWN_AUDIO_EXT = new Set(['aac', 'm4a']);

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
};

function stripQuery(s: string): string {
  return s.split('?')[0]?.split('#')[0] ?? s;
}

function extFromPathOrName(pathOrName: string): string {
  const base = stripQuery(pathOrName);
  const seg = base.split('/').pop() ?? base;
  const dot = seg.lastIndexOf('.');
  if (dot < 0 || dot >= seg.length - 1) return '';
  return seg.slice(dot + 1).toLowerCase();
}

export type MediaKind = 'image' | 'video' | 'audio';

export function buildMediaUploadPart(
  localUri: string,
  kind: MediaKind,
  fileName?: string | null,
): {uri: string; name: string; type: string} {
  const pool = kind === 'video' ? KNOWN_VIDEO_EXT : kind === 'audio' ? KNOWN_AUDIO_EXT : KNOWN_IMAGE_EXT;

  let ext = fileName ? extFromPathOrName(fileName) : '';
  if (!ext) ext = extFromPathOrName(localUri);

  /** iOS Live Photo / picker can mark HEIC as `video` — never send HEIC as a video upload. */
  if (kind === 'video' && (ext === 'heic' || ext === 'heif')) {
    ext = '';
  }

  const known = pool.has(ext);
  const fallbackExt =
    kind === 'video'
      ? Platform.OS === 'ios'
        ? 'mov'
        : 'mp4'
      : kind === 'audio'
        ? 'm4a'
        : Platform.OS === 'ios'
          ? 'heic'
          : 'jpg';

  const finalExt = known ? ext : fallbackExt;

  let name: string;
  if (fileName?.trim()) {
    const bn = stripQuery(fileName.trim()).split('/').pop() ?? '';
    const e = extFromPathOrName(bn);
    if (bn && pool.has(e) && !(kind === 'video' && (e === 'heic' || e === 'heif'))) {
      name = bn;
    } else {
      name = `bromo-${Date.now()}.${finalExt}`;
    }
  } else {
    name = `bromo-${Date.now()}.${finalExt}`;
  }

  const extOut = extFromPathOrName(name) || finalExt;
  const type =
    MIME_BY_EXT[extOut] ??
    (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mp4' : 'image/jpeg');

  return {uri: localUri, name, type};
}
