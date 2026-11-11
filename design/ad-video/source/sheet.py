# Contact sheet of chosen frames from a shot: python3 -I sheet.py <shot> <f1> <f2> ...
import sys, json
from PIL import Image, ImageDraw
shot = sys.argv[1]; fs = [int(x) for x in sys.argv[2:]]
meta = json.load(open(f'film/{shot}.json'))
ims = []
for f in fs:
    im = Image.open(f'film/{shot}/{f:04d}.jpg'); im = im.resize((393, 852), Image.LANCZOS)
    fg = meta['frames'][f]
    if fg:
        d = ImageDraw.Draw(im); r = 14 if fg['down'] else 18
        d.ellipse((fg['x'] - r, fg['y'] - r, fg['x'] + r, fg['y'] + r), outline=(255, 255, 255), width=3)
    ims.append(im)
s = Image.new('RGB', (len(ims) * 401, 852), (90, 90, 90))
for i, im in enumerate(ims): s.paste(im, (i * 401, 0))
s.save(f'film/{shot}-sheet.jpg', quality=80)
