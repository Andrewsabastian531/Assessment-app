import { AssetKind } from './enums';

/** "Max 10MB" is printed on both dropzones in the design — enforced on both ends. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = 'Max 10MB';

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
  'image/webp',
] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

/** Maps a MIME type to the extension we store in the object key. */
export const MIME_EXTENSION: Record<AcceptedMimeType, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
};

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  QUESTION_PAPER: 'Question Paper',
  ANSWER_SHEET: 'Answer Sheet',
};

/** Pre-signed PUT URLs are short-lived; the browser uploads immediately. */
export const PRESIGNED_PUT_TTL_SECONDS = 300;
/** Page images are re-fetched while the teacher reviews, so GETs live longer. */
export const PRESIGNED_GET_TTL_SECONDS = 3600;

/** Page rasterisation target — high enough for legible handwriting OCR. */
export const RASTER_DPI = 200;
export const MAX_PAGES_PER_SUBMISSION = 40;

/** Below this cosine similarity a question↔answer match is flagged for review. */
export const MAPPING_CONFIDENCE_THRESHOLD = 0.55;

export const SOCKET_NAMESPACE = '/events';
