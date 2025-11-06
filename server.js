// server-ffmpeg.js atau api/thumbnail-proxy.js

const express = require('express');
// Hapus 'const ffmpeg = require('fluent-ffmpeg');' karena tidak dipakai lagi
const path = require('path'); 
const app = express();
const PORT = 3000;

// --- KONFIGURASI API EKSTERNAL ---
// Ganti URL endpoint sesuai dokumentasi resmi API Anda
const FFMPEG_API_URL_START = 'https://api.ffmpeg-api.com/ffmpeg/process'; 
const API_KEY = 'SGxISW10ZHVmaDY2QlJMNnRDa0k6MTYxNDNkYjc5ODg2YjY2YjhlY2ZiN2Q4'; 
// Catatan: Gunakan process.env.FFMPEG_API_KEY saat deployment Vercel!
// ---------------------------------

app.use(express.json()); // Penting untuk menangani body JSON jika ada permintaan POST lain

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, POST'); // Tambah POST
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'); // Tambah Authorization
    next();
});

// Endpoint untuk static file (jika Anda memiliki index.html)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📸 Endpoint Proxy Thumbnail
app.get('/thumbnail-proxy', async (req, res) => {
    const videoURL = req.query.url;

    if (!videoURL) {
        return res.status(400).send('Parameter URL video (?url=...) tidak ditemukan.');
    }

    try {
        console.log(`[PROXY] Menerima permintaan untuk memproses: ${videoURL}`);

        // --- LANGKAH 1: MEMULAI TUGAS FFMPEG DI API EKSTERNAL ---
        const taskResponse = await fetch(FFMPEG_API_URL_START, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` 
            },
            body: JSON.stringify({
                task: {
                    inputs: [{ 
                        // 💡 MENGGUNAKAN 'url' BUKAN 'source'
                        url: videoURL 
                    }], 
                    outputs: [{
                        commands: [
                            "-ss 00:00:01", // Ambil frame di detik ke-1
                            "-vframes 1",  // Hanya 1 frame
                            "-s 640x360",  // Ubah ukuran
                            "output.jpg"   // Nama file output
                        ]
                    }]
                }
            })
        });

        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            throw new Error(`FFmpeg Service gagal (Status: ${taskResponse.status}). Detail: ${errorText.substring(0, 100)}`);
        }

        const taskResult = await taskResponse.json();
        
        // Asumsi: Ambil URL hasil dari respons JSON
        const thumbnailDownloadUrl = taskResult.output_url || taskResult.url; 
        
        if (!thumbnailDownloadUrl) {
             // Jika API mengembalikan data tugas, tapi belum selesai.
             throw new Error("FFmpeg Service berhasil, namun belum menyediakan URL download hasil atau tugas masih diproses.");
        }
        
        console.log(`[PROXY] Tugas berhasil. Mengambil thumbnail dari: ${thumbnailDownloadUrl}`);

        // --- LANGKAH 2: MENGAMBIL FILE THUMBNAIL HASIL ---
        const finalImageResponse = await fetch(thumbnailDownloadUrl);

        if (!finalImageResponse.ok) {
            throw new Error(`Gagal mengambil file thumbnail hasil. Status: ${finalImageResponse.status}`);
        }

        // 3. Set Header dan Pipe Hasil
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
        
        // Pipe stream dari gambar ke respons klien
        finalImageResponse.body.pipe(res); 

        console.log('[PROXY] Thumbnail selesai di-stream ke klien.');

    } catch (err) {
        console.error(`[ERROR] Gagal memproses: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).send(`Gagal memproses thumbnail. Error: ${err.message}`);
        }
    }
});

// Jalankan Server (Hanya untuk local development)
app.listen(PORT, () => {
    console.log(`Server lokal berjalan di http://localhost:${PORT}`);
});

// 🌐 Ekspor app untuk Vercel Serverless Function
module.exports = app;