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
const htmlPages = ["index", "about", "login", "register", "eporner", "vip"];
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

// Asumsi 'fetch' sudah tersedia (misalnya, jika Anda menggunakan Node 18+ atau library 'node-fetch')
// const fetch = require('node-fetch'); // Jika Anda menggunakan versi Node.js yang lebih lama

app.get('/video', async (req, res) => {
    const videoId = req.query.id;
    const baseUrl = 'https://videyindoviral.vercel.app'; 
    const htmlPath = path.join(__dirname, 'public', 'video.html'); // Pastikan path benar

    if (!videoId) {
        // Handle jika ID tidak ada atau gunakan ID default
        return res.redirect('/'); 
    }

    try {
        // 1. Ambil data video
        const data = await fetch(`${baseUrl}/vip.json`).then(r => r.json());
        const video = data.videos.find(v => v.id == videoId);

        if (!video) {
            // Jika video tidak ditemukan, kirim halaman 404
            return res.status(404).send('Video tidak ditemukan'); 
        }

        // 2. Siapkan data dinamis
        const title = `${video.title} | King Bokep`;
        const description = `Tonton video: ${video.title} (${video.durasi || '??'} menit).`;
        const imageUrl = `${baseUrl}/thumbnail?id=${video.id}`;
        const videoUrl = `${baseUrl}/video?id=${video.id}`;
        
        // 3. Baca file HTML statis
        let html = fs.readFileSync(htmlPath, 'utf8');

        // 4. Lakukan String Replacement untuk Meta Tags (SEO/OG)
        html = html
            // Ganti Title Halaman
            .replace(/__PAGE_TITLE__/g, title)
            
            // Ganti OG/Twitter Tags
            .replace(/__OG_TITLE__/g, video.title) 
            .replace(/__OG_DESCRIPTION__/g, description)
            .replace(/__OG_IMAGE__/g, imageUrl)
            .replace(/__OG_URL__/g, videoUrl)
            
            // Ganti Tipe (jika menggunakan placeholder __TYPE__)
            .replace(/__TYPE__/g, 'video.other'); 
            
            
        // 5. Ganti Video Player (Sama seperti sebelumnya, ini lebih baik daripada placeholder string)
        html = html.replace(/<video[^>]*id="videoPlayer"[^>]*>.*?<\/video>/s, `
            <div class="video-aspect-ratio bg-black rounded-xl overflow-hidden shadow-3xl border border-gray-800">
                <video id="videoPlayer" controls poster="${imageUrl}" class="absolute top-0 left-0 w-full h-full bg-black focus:outline-none">
                    <source src="${video.url}" type="video/mp4">
                    Browser Anda tidak mendukung tag video.
                </video>
            </div>
        `);


        res.send(html);
        
    } catch (err) {
        console.error('Terjadi kesalahan saat memproses video:', err);
        res.status(500).send('Terjadi kesalahan server.');
    }
});


// ---------------------------------------------------
// 5. Server Start
// ---------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
  console.log(`🔗 Coba akses: http://localhost:${PORT}/proxy-api`);
});
