import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// === KONFIGURASI ===
const API_KEY = "SGxISW10ZHVmaDY2QlJMNnRDa0k6MTYxNDNkYjc5ODg2YjY2YjhlY2ZiN2Q4";
const BASE_URL = "https://api.ffmpeg-api.com";
const MAX_RETRY = 5;
const RETRY_DELAY = 2000;

// === Helper delay ===
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// === CORS ===
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Buat directory kerja di FFmpeg API ===
async function createDirectory() {
  const res = await fetch(`${BASE_URL}/directory`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl: 3600 }), // berlaku 1 jam
  });

  if (!res.ok) throw new Error("Gagal membuat directory.");
  const data = await res.json();
  return data.directory.id;
}

// === Daftarkan file ke directory ===
async function registerFile(dirId, fileName) {
  const res = await fetch(`${BASE_URL}/file`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_name: fileName, dir_id: dirId }),
  });

  if (!res.ok) throw new Error("Gagal mendaftarkan file.");
  const data = await res.json();
  return data.upload.url; // URL PUT upload
}

// === Upload file video ===
async function uploadFile(uploadUrl, videoBuffer) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: videoBuffer,
  });
  if (!res.ok) throw new Error("Gagal upload file ke FFmpeg API.");
}

// === Proses thumbnail ===
async function processThumbnail(dirId, fileName) {
  const res = await fetch(`${BASE_URL}/ffmpeg/process`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: {
        inputs: [
          {
            file_path: `${dirId}/${fileName}`,
            options: ["-ss", "1"],
          },
        ],
        outputs: [
          {
            file: "thumbnail.jpg",
            options: ["-vframes", "1", "-s", "640x360"],
          },
        ],
      },
    }),
  });

  if (!res.ok) throw new Error("Gagal memproses thumbnail.");
  const data = await res.json();
  return data.result?.[0]?.download_url;
}

// === Retry logic untuk menghindari rate limit ===
async function withRetry(fn, maxRetries = MAX_RETRY) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[RETRY ${attempt}/${maxRetries}] ${err.message}`);
      if (attempt === maxRetries) throw err;
      await delay(RETRY_DELAY);
    }
  }
}

// === Endpoint utama ===
app.get("/thumbnail-proxy", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "Parameter ?url= wajib diisi." });
  }

  try {
    console.log(`[THUMBNAIL] Memproses video dari ${videoUrl}`);
    const tempFile = path.join("/tmp", `video-${Date.now()}.mp4`);

    // 1️⃣ Unduh video ke memori
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Gagal mengunduh video dari sumber.");
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // 2️⃣ Buat direktori kerja
    const dirId = await withRetry(() => createDirectory());

    // 3️⃣ Daftarkan file di FFmpeg API
    const uploadUrl = await withRetry(() => registerFile(dirId, "video.mp4"));

    // 4️⃣ Upload file
    await withRetry(() => uploadFile(uploadUrl, videoBuffer));

    // 5️⃣ Proses thumbnail
    const thumbUrl = await withRetry(() => processThumbnail(dirId, "video.mp4"));

    if (!thumbUrl) throw new Error("Thumbnail gagal diproses.");

    // 6️⃣ Ambil hasil thumbnail
    const imageRes = await fetch(thumbUrl);
    if (!imageRes.ok) throw new Error("Gagal mengambil hasil thumbnail.");

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    imageRes.body.pipe(res);
  } catch (err) {
    console.error("[ERROR]", err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "Gagal memproses thumbnail", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
