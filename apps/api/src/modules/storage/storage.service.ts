import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MIME_EXTENSION,
  PRESIGNED_GET_TTL_SECONDS,
  PRESIGNED_PUT_TTL_SECONDS,
  type AcceptedMimeType,
  type AssetKind,
} from '@vedaai/shared';

export interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

/** S3-compatible object storage. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION', 'auto'),
      // The config loader already coerces this to a boolean, but reading it
      // from a raw process.env would give a string — accept both.
      forcePathStyle: toBoolean(config.get('S3_FORCE_PATH_STYLE'), true),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Keys are namespaced by assessment so a whole exam can be lifecycle-expired or
   * deleted with a single prefix operation.
   */
  buildKey(assessmentId: string, kind: AssetKind, mimeType: AcceptedMimeType): string {
    const extension = MIME_EXTENSION[mimeType] ?? 'bin';
    const folder = kind === 'QUESTION_PAPER' ? 'question-papers' : 'answer-sheets';
    return `assessments/${assessmentId}/${folder}/${randomUUID()}.${extension}`;
  }

  buildPageKey(submissionId: string, pageIndex: number): string {
    return `submissions/${submissionId}/pages/${String(pageIndex).padStart(3, '0')}.png`;
  }

  async presignPut(
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_PUT_TTL_SECONDS,
    });

    return {
      storageKey,
      uploadUrl,
      expiresInSeconds: PRESIGNED_PUT_TTL_SECONDS,
      // The browser MUST replay these exact headers or the signature will not
      // match and storage rejects the PUT with 403.
      requiredHeaders: { 'Content-Type': mimeType },
    };
  }

  presignGet(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: PRESIGNED_GET_TTL_SECONDS },
    );
  }

  async download(storageKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    if (!response.Body) {
      throw new Error(`Object ${storageKey} has no body`);
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async upload(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Confirms the endpoint, credentials and bucket actually work. Pre-signing is
   * pure computation and never touches the network, so a misconfigured endpoint
   * stays invisible until a worker tries to read a file back.
   */
  async check(): Promise<{ ok: boolean; endpoint: string; bucket: string; error?: string }> {
    const endpoint = this.config.get<string>('S3_ENDPOINT', '');
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true, endpoint, bucket: this.bucket };
    } catch (error) {
      return { ok: false, endpoint, bucket: this.bucket, error: explain(error as Error) };
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    } catch (error) {
      // A missing object is not worth failing the request over — the caller has
      // already removed the database row.
      this.logger.warn(`Could not delete ${storageKey}: ${explain(error as Error)}`);
    }
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

/** Turns a transport-level failure into something that names the likely cause. */
function explain(error: Error): string {
  const message = error.message ?? String(error);

  if (/EPROTO|handshake failure|SSL alert/i.test(message)) {
    return (
      `TLS handshake with the storage endpoint failed. S3_ENDPOINT is probably not an ` +
      `S3 API URL. Supabase expects https://<project>.supabase.co/storage/v1/s3 and ` +
      `S3_FORCE_PATH_STYLE=true; R2 expects https://<account>.r2.cloudflarestorage.com ` +
      `and S3_FORCE_PATH_STYLE=false. (${message})`
    );
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `The storage host does not resolve. Check S3_ENDPOINT for a typo. (${message})`;
  }
  if (/ECONNREFUSED/i.test(message)) {
    return `The storage endpoint refused the connection. (${message})`;
  }
  if (/SignatureDoesNotMatch/i.test(message)) {
    return `Storage rejected the signature. Check the key pair and S3_REGION. (${message})`;
  }
  if (/NoSuchBucket|NotFound/i.test(message)) {
    return `The bucket does not exist at that endpoint. Check S3_BUCKET. (${message})`;
  }
  return message;
}
