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

/** iOS `ph://` URIs often omit a normal basename — try to read `.mp4` / `.mov` from the path tail. */
function inferVideoExtFromUri(uri: string): string {
  const base = stripQuery(uri);
  const m = base.match(/\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg)(?:$|[?#])/i);
  return m?.[1]?.toLowerCase() ?? '';
}

export type MediaKind = 'image' | 'video' | 'audio';

export function buildMediaUploadPart(
  localUri: string,
  kind: MediaKind,
  fileName?: string | null,
): {uri: string; name: string; type: string} {
  /** HEIC/HEIF can be motion video on iOS — keep extension + image/* MIME so the server can probe and transcode. */
  const pool =
    kind === 'video'
      ? new Set<string>([...KNOWN_VIDEO_EXT, 'heic', 'heif'])
      : kind === 'audio'
        ? KNOWN_AUDIO_EXT
        : KNOWN_IMAGE_EXT;

  let ext = fileName ? extFromPathOrName(fileName) : '';
  if (!ext) ext = extFromPathOrName(localUri);
  if (kind === 'video' && !ext) ext = inferVideoExtFromUri(localUri);

  const known = pool.has(ext);
  /** Default video container: MP4 on all platforms (iOS used to force `.mov`, which confused users and MIME mapping). */
  const fallbackExt =
    kind === 'video'
      ? 'mp4'
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
    if (bn && pool.has(e)) {
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
