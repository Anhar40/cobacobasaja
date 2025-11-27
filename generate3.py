import json
import os
import subprocess
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from base64 import b64encode

def generate_thumbnail_from_url(url, thumb_path):
    """
    Ambil 1 frame dari URL video tanpa download keseluruhan.
    """
    cmd = [
        "ffmpeg", "-y", "-i", url,
        "-ss", "00:00:01", "-vframes", "1",
        thumb_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def encrypt_file(file_path):
    """
    Enkripsi file menggunakan AES-GCM (compatible dengan browser WebCrypto)
    """
    key = get_random_bytes(16)  # 128-bit key
    cipher = AES.new(key, AES.MODE_GCM)

    with open(file_path, "rb") as f:
        data = f.read()

    ciphertext, tag = cipher.encrypt_and_digest(data)

    return {
        "nonce": b64encode(cipher.nonce).decode(),        # IV untuk GCM
        "ciphertext": b64encode(ciphertext).decode(),
        "tag": b64encode(tag).decode(),
        "key": b64encode(key).decode()                     # Opsional, jika ingin testing
    }

def txt_to_json(file_name):
    data = []

    with open(file_name, 'r') as f:
        lines = [line.strip() for line in f if line.strip()]

    # Setiap item 4 baris (title, url, durasi, thumbnail placeholder)
    if len(lines) % 4 != 0:
        raise ValueError("Format salah: harus 4 baris tiap item (title,url,durasi,thumbnail).")

    for i in range(0, len(lines), 4):
        title = lines[i].split("=",1)[1].strip()
        url = lines[i+1].split("=",1)[1].strip()
        durasi = lines[i+2].split("=",1)[1].strip()
        # Thumbnail baris ke-4 sengaja kosong / placeholder

        thumb_path = f"thumb_{i//4}.jpg"

        print(f"🖼 Generate thumbnail dari URL → {url}")
        generate_thumbnail_from_url(url, thumb_path)

        print("🔐 Encrypt thumbnail...")
        encrypted_thumb = encrypt_file(thumb_path)

        os.remove(thumb_path)

        data.append({
            "title": title,
            "url": url,
            "durasi": durasi,
            "thumbnail_encrypted": encrypted_thumb
        })

    with open("output.json", "w") as f:
        json.dump(data, f, indent=4)

    print("✔ output.json berhasil dibuat!")

# Jalankan
txt_to_json("tes.txt")
