// server-ffmpeg.js
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const app = express();
const PORT = 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Endpoint utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/thumbnail-proxy', (req, res) => {
    const videoURL = req.query.url;
    
    if (!videoURL) {
        // Respons error jika URL tidak disediakan
        return res.status(400).send('Parameter URL video (?url=...) tidak ditemukan.');
    }

    console.log(`[PROXY] Menerima permintaan thumbnail untuk: ${videoURL}`);
    
    // Konfigurasi FFmpeg
    ffmpeg(videoURL)
        // Ambil frame pada detik ke-1 (atau detik ke-N jika Anda mau)
        .seekInput('00:00:01') 
        // Hanya ambil 1 frame
        .frames(1)
        // Ukuran output (misalnya, 640x360) untuk gambar thumbnail yang efisien
        .size('640x360') 
        // Output ke memori (stream)
        .format('image2pipe')
        
        // --- PROSES DAN STREAMING HASIL ---
        .on('start', function() {
            // Header: Tentukan jenis konten adalah JPEG
            res.setHeader('Content-Type', 'image/jpeg');
            
            // Header CACHING (Kunci untuk tidak me-load ulang):
            // 'public': Dapat di-cache oleh browser dan CDN.
            // 'max-age=86400': Cache selama 86400 detik (24 jam).
            // 'must-revalidate': Setelah 24 jam, browser harus memvalidasi ulang.
            res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate'); 
            
            console.log(`[FFMPEG] Mulai memproses frame...`);
        })
        .on('error', function(err) {
            console.error(`[ERROR] Gagal memproses: ${err.message}`);
            
            // Jika header belum terkirim (respons masih bisa diubah)
            if (!res.headersSent) {
                // Berikan pesan error dan status 500
                res.status(500).send('Gagal memproses video. Cek URL, CORS, atau instalasi FFmpeg.');
            }
        })
        .on('end', function() {
            console.log('[FFMPEG] Pembuatan thumbnail selesai dan dikirim.');
        })
        .pipe(res); // Arahkan stream output FFmpeg langsung ke respons HTTP
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Thumbnail Proxy Server BERJALAN di: http://localhost:${PORT}`);
    console.log(`Akses Endpoint: http://localhost:${PORT}/thumbnail-proxy?url=...`);
    console.log(`======================================================`);
    console.log(`JANGAN LUPA: Run index.html melalui server web (port lain).`);
});