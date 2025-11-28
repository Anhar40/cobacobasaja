import json

# File input & output
input_file = "public/videos.json"     # file JSON kamu
output_file = "output.txt"   # file TXT hasil

# Baca JSON
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

videos = data.get("videos", [])

# Tulis ke TXT
with open(output_file, "w", encoding="utf-8") as f:
    for idx, video in enumerate(videos, start=23):
        title = video.get("title", "")
        url = video.get("url", "")

        f.write(f"title = {title}\n")
        f.write(f"url = {url}\n")
        f.write(f"thumbnail = \n")   # thumbnail dikosongkan
        f.write(f"id = {idx}\n\n")

print("✔ File berhasil dibuat:", output_file)
