import {Platform} from 'react-native';

/** Build RN FormData file part for /media/upload — ensures a real extension for multer. */

const KNOWN_IMAGE_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
]);
const KNOWN_VIDEO_EXT = new Set(['mp4', 'mov', 'm4v', '3gp', 'webm']);
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
  aac: 'audio/aac',
  m4a: 'audio/mp4',
};

export type MediaKind = 'image' | 'video' | 'audio';

export function buildMediaUploadPart(
  localUri: string,
  kind: MediaKind,
  fileName?: string | null,
): {uri: string; name: string; type: string} {
  const stripQuery = (s: string) => s.split('?')[0] ?? s;
  const raw =
    (fileName && stripQuery(fileName).trim()) ||
    stripQuery(localUri.split('/').pop() ?? '') ||
    '';

  let ext = '';
  const dot = raw.lastIndexOf('.');
  if (dot >= 0 && dot < raw.length - 1) {
    ext = raw.slice(dot + 1).toLowerCase();
  }

  const known =
    kind === 'video'
      ? KNOWN_VIDEO_EXT.has(ext)
      : kind === 'audio'
        ? KNOWN_AUDIO_EXT.has(ext)
        : KNOWN_IMAGE_EXT.has(ext);

  const fallbackExt =
    kind === 'video'
      ? 'mp4'
      : kind === 'audio'
        ? 'm4a'
        : Platform.OS === 'ios'
          ? 'heic'
          : 'jpg';
  const name = known ? raw.split('/').pop()! : `bromo-${Date.now()}.${fallbackExt}`;
  const finalExt = name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? fallbackExt) : fallbackExt;

  const type = MIME_BY_EXT[finalExt] ?? (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mp4' : 'image/jpeg');

  return {uri: localUri, name, type};
}
