import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// NSFW check via local nsfwjs running in the signaling server (no API limits, offline-capable).
async function isNsfw(buffer: Buffer): Promise<boolean> {
  const signalingUrl = process.env.SIGNALING_INTERNAL_URL || "http://signaling:4000";
  try {
    const res = await fetch(`${signalingUrl}/api/check-nsfw`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buffer as unknown as BodyInit,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { nsfw?: boolean };
    return data.nsfw === true;
  } catch {
    return false; // fail open on timeout / signaling server unreachable
  }
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable({ maxFileSize: MAX_SIZE });
  let files: formidable.Files;
  try {
    [, files] = await form.parse(req);
  } catch {
    return res.status(413).json({ error: "File too large (max 5 MB)." });
  }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "No file provided." });

  const mime = file.mimetype || "";
  if (!ALLOWED_TYPES.includes(mime)) return res.status(415).json({ error: "Unsupported file type." });

  try {
    const raw = fs.readFileSync(file.filepath);
    let buffer: Buffer;
    let contentType: string;

    if (mime === "image/gif") {
      buffer = raw;
      contentType = "image/gif";
    } else {
      buffer = await sharp(raw)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = "image/webp";
    }

    // NSFW gate — run after processing so we have the final buffer
    if (await isNsfw(buffer)) {
      return res.status(422).json({ error: "Image rejected: explicit or harmful content detected." });
    }

    const ext = mime === "image/gif" ? "gif" : "webp";
    const key = `chat-images/${uuidv4()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=86400",
    }));

    const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
    res.json({ url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    res.status(500).json({ error: msg });
  }
}
