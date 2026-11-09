import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { resolve } from "path";
import { dimensions, sniff } from "./image";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

@Injectable()
export class StorageService {
  private bucket = process.env.S3_BUCKET ?? "";
  private localMode = process.env.NODE_ENV !== "production"
    && !(this.bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  private localDirectory = resolve(__dirname, "../../uploads");
  private localUploadTokens = new Map<string, { key: string; contentType: string; expiresAt: number }>();
  private s3 = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
  });

  constructor() {
    if (this.localMode) {
      console.warn("Object storage is not configured. Using local chapter uploads in the API uploads directory.");
    }
  }

  async presignPut(key: string, contentType: string) {
    if (this.localMode) {
      const token = randomBytes(32).toString("base64url");
      this.localUploadTokens.set(token, { key, contentType, expiresAt: Date.now() + 10 * 60_000 });
      for (const [pendingToken, pending] of this.localUploadTokens) {
        if (pending.expiresAt <= Date.now()) this.localUploadTokens.delete(pendingToken);
      }
      const apiBase = (process.env.API_PUBLIC_URL || "http://localhost:4000/api").replace(/\/+$/, "");
      return `${apiBase}/local-uploads/${token}`;
    }
    return getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
  }

  async readUrl(key: string) {
    if (this.localMode) {
      const apiBase = (process.env.API_PUBLIC_URL || "http://localhost:4000/api").replace(/\/+$/, "");
      return `${apiBase}/media?key=${encodeURIComponent(key)}`;
    }
    const cdn = process.env.CDN_BASE_URL;
    if (cdn) return `${cdn.replace(/\/$/, "")}/${key}`;
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }

  async put(key: string, body: Buffer, contentType: string) {
    if (this.localMode) {
      await this.writeLocalFile(key, body);
      return;
    }
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async remove(key: string) {
    if (this.localMode) {
      try {
        await rm(this.localPath(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      return;
    }
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }

  async acceptLocalUpload(token: string, contentType: string, body: Buffer) {
    if (!this.localMode) throw new NotFoundException("Upload not found.");
    const upload = this.localUploadTokens.get(token);
    if (!upload || upload.expiresAt <= Date.now()) {
      this.localUploadTokens.delete(token);
      throw new NotFoundException("Upload link expired. Request a new upload and try again.");
    }
    if (contentType !== upload.contentType || !IMAGE_TYPES[contentType]) {
      throw new BadRequestException("Uploaded file type did not match the requested image type.");
    }
    if (!Buffer.isBuffer(body) || body.length === 0 || body.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException("Image must be non-empty and no larger than 10 MB.");
    }
    if (sniff(body) !== contentType) throw new BadRequestException("File contents do not match the selected image type.");
    await this.writeLocalFile(upload.key, body);
    this.localUploadTokens.delete(token);
  }

  async readLocalFile(key: string) {
    if (!this.localMode) throw new NotFoundException("Media not found.");
    try {
      const body = await readFile(this.localPath(key));
      const mime = Object.entries(IMAGE_TYPES).find(([, ext]) => key.endsWith(`.${ext}`))?.[0];
      if (!mime) throw new NotFoundException("Media not found.");
      return { body, mime };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundException("Media not found.");
      throw error;
    }
  }

  /** Verifies an uploaded object: exists, within size limit, real image bytes. Returns its SHA-256. */
  async inspect(key: string) {
    if (this.localMode) {
      const path = this.localPath(key);
      const metadata = await stat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") throw new BadRequestException("Upload not found. Upload the file before registering it.");
        throw error;
      });
      if (!metadata.size || metadata.size > MAX_IMAGE_BYTES) {
        await this.remove(key); throw new BadRequestException("Image is larger than 10 MB.");
      }
      const buf = await readFile(path);
      const mime = sniff(buf);
      if (!mime) { await this.remove(key); throw new BadRequestException("File is not a supported image (JPEG, PNG, WebP or AVIF)."); }
      return { sha256: createHash("sha256").update(buf).digest("hex"), ...(dimensions(buf, mime) ?? {}) };
    }
    let head;
    try { head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); }
    catch (error) {
      const storageError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (storageError.name === "NotFound" || storageError.name === "NoSuchKey" || storageError.$metadata?.httpStatusCode === 404) {
        throw new BadRequestException("Upload not found. Upload the file before registering it.");
      }
      throw new ServiceUnavailableException("Could not verify the uploaded image in object storage. Check the bucket credentials and permissions.");
    }
    if (!head.ContentLength || head.ContentLength > MAX_IMAGE_BYTES) {
      await this.remove(key); throw new BadRequestException("Image is larger than 10 MB.");
    }
    const obj = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const buf = Buffer.from(await obj.Body!.transformToByteArray());
    const mime = sniff(buf);
    if (!mime) { await this.remove(key); throw new BadRequestException("File is not a supported image (JPEG, PNG, WebP or AVIF)."); }
    return { sha256: createHash("sha256").update(buf).digest("hex"), ...(dimensions(buf, mime) ?? {}) };
  }

  private localPath(key: string) {
    if (!key || key.includes("\\") || key.includes("..") || key.startsWith("/")) {
      throw new BadRequestException("Invalid media key.");
    }
    const path = resolve(this.localDirectory, key);
    if (!path.startsWith(`${this.localDirectory}/`) && !path.startsWith(`${this.localDirectory}\\`)) {
      throw new BadRequestException("Invalid media key.");
    }
    return path;
  }

  private async writeLocalFile(key: string, body: Buffer) {
    const path = this.localPath(key);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, body);
  }
}
