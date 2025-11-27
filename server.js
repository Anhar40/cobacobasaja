import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

// dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================
// PROXY API FIX TANPA BLOKIR
// ===========================
app.get("/proxy-api", async (req, res) => {
    try {
        const url = "https://www.eporner.com/api/v2/video/search/";

        console.log("🔍 Fetching URL:", url);

        // Timeout manual 8 detik
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://www.eporner.com/",
                "Origin": "https://www.eporner.com",
                "Accept-Language": "en-US,en;q=0.8"
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.log("❌ BAD STATUS:", response.status);
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
            err.name === "AbortError" ||
            err.code === "ETIMEDOUT" ||
            err.message.includes("timeout");

        res.status(500).json({
            error: true,
            message: isTimeout ? "Timeout menghubungi API" : "Gagal mengambil data API",
            detail: err.message
        });
    }
});

// ===========================
// STATIC FILES + ROUTES
// ===========================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Coba: http://localhost:${PORT}/proxy-api?q=indo`);
});
