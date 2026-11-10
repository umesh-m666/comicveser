"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = exports.IMAGE_TYPES = exports.MAX_IMAGE_BYTES = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const image_1 = require("./image");
exports.MAX_IMAGE_BYTES = 10 * 1024 * 1024;
exports.IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
let StorageService = class StorageService {
    bucket = process.env.S3_BUCKET ?? "";
    localMode = process.env.NODE_ENV !== "production"
        && !(this.bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
    localDirectory = (0, path_1.resolve)(__dirname, "../../uploads");
    localUploadTokens = new Map();
    s3 = new client_s3_1.S3Client({
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
    async presignPut(key, contentType) {
        if (this.localMode) {
            const token = (0, crypto_1.randomBytes)(32).toString("base64url");
            this.localUploadTokens.set(token, { key, contentType, expiresAt: Date.now() + 10 * 60_000 });
            for (const [pendingToken, pending] of this.localUploadTokens) {
                if (pending.expiresAt <= Date.now())
                    this.localUploadTokens.delete(pendingToken);
            }
            const apiBase = (process.env.API_PUBLIC_URL || "http://localhost:4000/api").replace(/\/+$/, "");
            return `${apiBase}/local-uploads/${token}`;
        }
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3, new client_s3_1.PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
    }
    async readUrl(key) {
        if (this.localMode) {
            const apiBase = (process.env.API_PUBLIC_URL || "http://localhost:4000/api").replace(/\/+$/, "");
            return `${apiBase}/media?key=${encodeURIComponent(key)}`;
        }
        const cdn = process.env.CDN_BASE_URL;
        if (cdn)
            return `${cdn.replace(/\/$/, "")}/${key}`;
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3, new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
    }
    async put(key, body, contentType) {
        if (this.localMode) {
            await this.writeLocalFile(key, body);
            return;
        }
        await this.s3.send(new client_s3_1.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    }
    async remove(key) {
        if (this.localMode) {
            try {
                await (0, promises_1.rm)(this.localPath(key));
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    throw error;
            }
            return;
        }
        await this.s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
    }
    async acceptLocalUpload(token, contentType, body) {
        if (!this.localMode)
            throw new common_1.NotFoundException("Upload not found.");
        const upload = this.localUploadTokens.get(token);
        if (!upload || upload.expiresAt <= Date.now()) {
            this.localUploadTokens.delete(token);
            throw new common_1.NotFoundException("Upload link expired. Request a new upload and try again.");
        }
        if (contentType !== upload.contentType || !exports.IMAGE_TYPES[contentType]) {
            throw new common_1.BadRequestException("Uploaded file type did not match the requested image type.");
        }
        if (!Buffer.isBuffer(body) || body.length === 0 || body.length > exports.MAX_IMAGE_BYTES) {
            throw new common_1.BadRequestException("Image must be non-empty and no larger than 10 MB.");
        }
        if ((0, image_1.sniff)(body) !== contentType)
            throw new common_1.BadRequestException("File contents do not match the selected image type.");
        await this.writeLocalFile(upload.key, body);
        this.localUploadTokens.delete(token);
    }
    async readLocalFile(key) {
        if (!this.localMode)
            throw new common_1.NotFoundException("Media not found.");
        try {
            const body = await (0, promises_1.readFile)(this.localPath(key));
            const mime = Object.entries(exports.IMAGE_TYPES).find(([, ext]) => key.endsWith(`.${ext}`))?.[0];
            if (!mime)
                throw new common_1.NotFoundException("Media not found.");
            return { body, mime };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            if (error.code === "ENOENT")
                throw new common_1.NotFoundException("Media not found.");
            throw error;
        }
    }
    /** Verifies an uploaded object: exists, within size limit, real image bytes. Returns its SHA-256. */
    async inspect(key) {
        if (this.localMode) {
            const path = this.localPath(key);
            const metadata = await (0, promises_1.stat)(path).catch((error) => {
                if (error.code === "ENOENT")
                    throw new common_1.BadRequestException("Upload not found. Upload the file before registering it.");
                throw error;
            });
            if (!metadata.size || metadata.size > exports.MAX_IMAGE_BYTES) {
                await this.remove(key);
                throw new common_1.BadRequestException("Image is larger than 10 MB.");
            }
            const buf = await (0, promises_1.readFile)(path);
            const mime = (0, image_1.sniff)(buf);
            if (!mime) {
                await this.remove(key);
                throw new common_1.BadRequestException("File is not a supported image (JPEG, PNG, WebP or AVIF).");
            }
            return { sha256: (0, crypto_1.createHash)("sha256").update(buf).digest("hex"), ...((0, image_1.dimensions)(buf, mime) ?? {}) };
        }
        let head;
        try {
            head = await this.s3.send(new client_s3_1.HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        }
        catch (error) {
            const storageError = error;
            if (storageError.name === "NotFound" || storageError.name === "NoSuchKey" || storageError.$metadata?.httpStatusCode === 404) {
                throw new common_1.BadRequestException("Upload not found. Upload the file before registering it.");
            }
            throw new common_1.ServiceUnavailableException("Could not verify the uploaded image in object storage. Check the bucket credentials and permissions.");
        }
        if (!head.ContentLength || head.ContentLength > exports.MAX_IMAGE_BYTES) {
            await this.remove(key);
            throw new common_1.BadRequestException("Image is larger than 10 MB.");
        }
        const obj = await this.s3.send(new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key }));
        const buf = Buffer.from(await obj.Body.transformToByteArray());
        const mime = (0, image_1.sniff)(buf);
        if (!mime) {
            await this.remove(key);
            throw new common_1.BadRequestException("File is not a supported image (JPEG, PNG, WebP or AVIF).");
        }
        return { sha256: (0, crypto_1.createHash)("sha256").update(buf).digest("hex"), ...((0, image_1.dimensions)(buf, mime) ?? {}) };
    }
    localPath(key) {
        if (!key || key.includes("\\") || key.includes("..") || key.startsWith("/")) {
            throw new common_1.BadRequestException("Invalid media key.");
        }
        const path = (0, path_1.resolve)(this.localDirectory, key);
        if (!path.startsWith(`${this.localDirectory}/`) && !path.startsWith(`${this.localDirectory}\\`)) {
            throw new common_1.BadRequestException("Invalid media key.");
        }
        return path;
    }
    async writeLocalFile(key, body) {
        const path = this.localPath(key);
        await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
        await (0, promises_1.writeFile)(path, body);
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StorageService);
