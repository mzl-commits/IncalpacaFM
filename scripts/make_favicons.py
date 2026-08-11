import os
import base64
from PIL import Image, ImageDraw

src_path = r"C:\Users\byun9\.gemini\antigravity\brain\c208c35a-74c4-4b30-b6ec-e59e3f2ce4ed\.user_uploaded\media__1786370413411.png"
out_dir = r"C:\Users\byun9\IncalpacaFM\frontend\public"

user_img = Image.open(src_path).convert("RGBA")

# Canvas size 512x512 with logo centered and padded ("mas borde")
canvas_size = 512
logo_size = 360
margin = (canvas_size - logo_size) // 2

logo_resized = user_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

# Create container with rounded corners ("esquinas mas pequeñas / redondeadas")
mask = Image.new("L", (canvas_size, canvas_size), 0)
draw = ImageDraw.Draw(mask)
radius = 72
draw.rounded_rectangle([0, 0, canvas_size, canvas_size], radius=radius, fill=255)

# Background frame
frame_bg = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
frame_bg.paste(logo_resized, (margin, margin), logo_resized)

final_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
final_img.paste(frame_bg, (0, 0), mask)

png_path = os.path.join(out_dir, "favicon.png")
ico_path = os.path.join(out_dir, "favicon.ico")
svg_path = os.path.join(out_dir, "favicon.svg")

final_img.save(png_path, "PNG")
final_img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

with open(png_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" href="data:image/png;base64,{b64}" />
</svg>
'''

with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)

print("Favicons (PNG, ICO, SVG) successfully created from exact user image!")
