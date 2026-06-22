import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import sharp from "sharp";
import { uploadAvatar } from "@/lib/r2";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable({ maxFileSize: 2 * 1024 * 1024 });
  const [fields, files] = await form.parse(req);
  const userId = fields.userId?.[0];
  const file = Array.isArray(files.file) ? files.file[0] : files.file;

  if (!userId || !file) return res.status(400).json({ error: "Missing fields" });

  // Verify auth
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== userId) return res.status(403).json({ error: "Forbidden" });

  try {
    const buffer = await sharp(fs.readFileSync(file.filepath))
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    const url = await uploadAvatar(userId, buffer, "image/webp");
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
