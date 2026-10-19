"""Generate responsive WebP sequences from the original GIF frames."""
from pathlib import Path
import argparse
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path('assets/source-frames'))
parser.add_argument('--output', type=Path, default=Path('public/frames/v2'))
args = parser.parse_args()
sources = sorted(args.source.glob('*.gif'))
if len(sources) < 2:
    parser.error('Source directory must contain the original GIF sequence')
for variant, width in (('desktop', 800), ('mobile', 480)):
    destination = args.output / variant
    destination.mkdir(parents=True, exist_ok=True)
    for index in range(60):
        source = sources[round(index * (len(sources) - 1) / 59)]
        with Image.open(source) as original:
            image = original.convert('RGB')
            image.thumbnail((width, 2000), Image.Resampling.LANCZOS)
            image.save(destination / f'{index:03}.webp', 'WEBP', quality=76, method=6)
    files = list(destination.glob('*.webp'))
    print(f'{variant}: {len(files)} frames, {sum(p.stat().st_size for p in files):,} bytes')
