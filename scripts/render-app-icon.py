"""Render the Reqoto mark inside the standard macOS icon canvas (824/1024)."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'src/assets'
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
scale = 824 / 128
offset = 100

def rect(box, radius, color):
    draw.rounded_rectangle(tuple(offset + value * scale for value in box), radius=radius * scale, fill=color)

def polygon(points, color):
    draw.polygon([(offset+x*scale, offset+y*scale) for x,y in points], fill=color)

rect((0, 0, 127, 127), 26, '#FFD83D')
rect((30, 25, 51, 103), 6, '#171717')
rect((43, 25, 96, 75), 23, '#171717')
polygon([(54, 66), (76, 66), (104, 103), (79, 103)], '#171717')
rect((53, 42, 77, 58), 8, '#FFD83D')
canvas.save(out / 'reqoto.png')
canvas.save(out / 'reqoto.icns', format='ICNS')
