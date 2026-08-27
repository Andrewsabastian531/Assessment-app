import type {
  ConfirmUploadInput,
  Evaluation,
  OverrideEvaluationInput,
  PresignRequest,
  PresignResponse,
  ReviewPayload,
  StartMappingInput,
  StartMappingResponse,
} from '@vedaai/shared';

/**
 * A trailing slash pasted into the host config produces `//api/v1/...`, which
 * the API answers with a bare "Cannot POST". Normalise once, here.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

/** Set NEXT_PUBLIC_UI_PREVIEW=1 to exercise the UI without a running backend. */
export const UI_PREVIEW = process.env.NEXT_PUBLIC_UI_PREVIEW === '1';

/**
 * Browser traffic goes through this app's own origin and is relayed server-side
 * (see app/api/proxy). The session cookie belongs to this domain, so it cannot
 * authenticate a request sent straight to the API on another domain.
 *
 * On the server there is no cookie to forward and no CORS, so the API is called
 * directly.
 */
const REQUEST_BASE =
  typeof window === 'undefined' ? `${API_URL}/api/v1` : '/api/proxy';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${REQUEST_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Proves the request came from our own code, not a cross-site page.
      // The API will not honour the session cookie without it.
      'X-VedaAI-Client': 'web',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    let details: unknown;
    try {
      const body = await response.json();
      message = body.message ?? message;
      details = body.details;
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  presignUpload: (assessmentId: string, body: PresignRequest) =>
    request<PresignResponse>(`/assessments/${assessmentId}/uploads/presign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  confirmUpload: (assessmentId: string, body: ConfirmUploadInput) =>
    request<void>(`/assessments/${assessmentId}/uploads/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteAsset: (assetId: string) => request<void>(`/assets/${assetId}`, { method: 'DELETE' }),

  startMapping: (assessmentId: string, body: StartMappingInput) =>
    request<StartMappingResponse>(`/assessments/${assessmentId}/start-mapping`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getReviewPayload: (submissionId: string) =>
    request<ReviewPayload>(`/submissions/${submissionId}`),

  overrideEvaluation: (evaluationId: string, body: OverrideEvaluationInput) =>
    request<Evaluation>(`/evaluations/${evaluationId}/override`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  finalizeSubmission: (submissionId: string) =>
    request<void>(`/submissions/${submissionId}/finalize`, { method: 'POST' }),

  createAssessment: (title: string) =>
    request<{ id: string }>('/assessments', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
};

/**
 * Uploads straight to object storage with XHR rather than fetch, because fetch still
 * cannot report upload progress and the file chips show a progress bar.
 */
export function putToStorage(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(`Storage rejected the upload (${xhr.status})`, xhr.status));
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.send(file);
  });
}
