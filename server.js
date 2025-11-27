import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import { Buffer } from "buffer";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Fix __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path ke vip.json
const dataPath = path.join(__dirname, "public/vip.json");

// ---------------------------------------------------
// 1. Proxy API (tetap seperti sebelumnya)
// ---------------------------------------------------
app.get("/proxy-api", async (req, res) => {
  try {
    const url = "https://www.eporner.com/api/v2/video/search/";
    console.log("🔍 Fetching URL:", url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.eporner.com/",
        Origin: "https://www.eporner.com",
        "Accept-Language": "en-US,en;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: "Gagal fetch API, status bukan 200",
        status: response.status,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Proxy Error:", err);
    const isTimeout =
      err.name === "AbortError" || err.code === "ETIMEDOUT" || err.message.includes("timeout");
    res.status(500).json({
      error: true,
      message: isTimeout ? "Timeout menghubungi API" : "Gagal mengambil data API",
      detail: err.message,
    });
  }
});

// ---------------------------------------------------
// 2. Static Files
// ---------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------
// 3. Routes HTML
// ---------------------------------------------------
const htmlPages = ["index", "about", "login", "register", "eporner", "video"];
htmlPages.forEach((page) => {
  app.get(`/${page === "index" ? "" : page}`, (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
  });
});

// ---------------------------------------------------
// 4. Endpoint Thumbnail (AES-GCM decrypt)
// ---------------------------------------------------
app.get("/thumbnail", async (req, res) => {
  try {
    const id = parseInt(req.query.id);
    if (isNaN(id)) return res.status(400).send("Invalid id");

    // Baca vip.json
    if (!fs.existsSync(dataPath)) {
      return res.status(404).send("vip.json belum ada");
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const parsedData = JSON.parse(rawData);
    const allVideos = parsedData.videos || [];
    const video = allVideos[id];

    if (!video || !video.thumbnail_encrypted)
      return res.status(404).send("Thumbnail not found");

    const { key, nonce, ciphertext, tag } = video.thumbnail_encrypted;

    const keyBuffer = Buffer.from(key, "base64");
    const nonceBuffer = Buffer.from(nonce, "base64");
    const ciphertextBuffer = Buffer.from(ciphertext, "base64");
    const tagBuffer = Buffer.from(tag, "base64");

    // AES-GCM decrypt
    const decipher = crypto.createDecipheriv("aes-128-gcm", keyBuffer, nonceBuffer);
    decipher.setAuthTag(tagBuffer);

    const decrypted = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);

    res.setHeader("Content-Type", "image/jpeg");
    res.send(decrypted);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to decrypt thumbnail");
  }
});

app.get('/video/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    const data = await fetch('https://videyindoviral.vercel.app/vip.json').then(r => r.json());
    const video = data.videos.find(v => v.id == videoId);

    if (!video) return res.status(404).send('Video tidak ditemukan');

    // HTML dinamis dengan OG tags
    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${video.title} | King Bokep</title>
        <meta property="og:title" content="${video.title}" />
        <meta property="og:description" content="Tonton video: ${video.title} (${video.durasi}) menit." />
        <meta property="og:image" content="https://videyindoviral.vercel.app/thumbnail?id=${video.id}" />
        <meta property="og:url" content="https://videyindoviral.vercel.app/video/${video.id}" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body>
        <h1>${video.title}</h1>
        <video width="600" controls>
          <source src="${video.url}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan server');
  }
});

// ---------------------------------------------------
// 5. Server Start
// ---------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
  console.log(`🔗 Coba akses: http://localhost:${PORT}/proxy-api`);
});
