import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(
  file: File,
  subfolder: string
): Promise<string> {
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, subfolder);
  await fs.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${subfolder}/${filename}`;
}

export async function saveBuffer(
  buffer: Buffer,
  subfolder: string,
  ext = ".png"
): Promise<string> {
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, subfolder);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${subfolder}/${filename}`;
}