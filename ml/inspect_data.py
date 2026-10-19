import sys
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image, UnidentifiedImageError

ALLOWED_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

def list_image_files(root: Path):
    return [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in ALLOWED_EXTS]

def count_images_in_dir(dir_path: Path):
    count = 0
    sizes = []
    corrupt = []
    for img_path in list_image_files(dir_path):
        try:
            with Image.open(img_path) as im:
                im.verify()
            with Image.open(img_path) as im:
                sizes.append(im.size)
            count += 1
        except (UnidentifiedImageError, OSError, IOError):
            corrupt.append(str(img_path))
    return count, sizes, corrupt

def main():
    base = Path('ml/data/raw')
    garbage_root = base / 'garbage-classification-v2' / 'original'
    if not garbage_root.is_dir():
        print('ERROR: missing folder ml/data/raw/garbage-classification-v2/original', file=sys.stderr)
        sys.exit(1)
    print('=== Garbage Classification v2 (original) ===')
    class_dirs = {p.name: p for p in garbage_root.iterdir() if p.is_dir()}
    total = 0
    for cls in sorted(class_dirs):
        cnt, _, corrupt = count_images_in_dir(class_dirs[cls])
        total += cnt
        print(f'{cls:12}: {cnt:6d} images')
        if corrupt:
            print(f'  corrupt files: {len(corrupt)}')
    print(f'Total images: {total}')
    waste_root = base / 'waste-classification-data-v2' / 'DATASET' / 'TRAIN'
    if not waste_root.is_dir():
        print('ERROR: missing folder ml/data/raw/waste-classification-data-v2/DATASET/TRAIN', file=sys.stderr)
        sys.exit(1)
    print('\n=== Waste Classification TRAIN (O,R) ===')
    for sub in ['O', 'R']:
        sub_path = waste_root / sub
        if not sub_path.is_dir():
            print(f'  {sub}: MISSING')
            continue
        cnt, _, corrupt = count_images_in_dir(sub_path)
        print(f'  {sub}: {cnt:6d} images')
        if corrupt:
            print(f'    corrupt files: {len(corrupt)}')
    # size range for waste
    waste_sizes = []
    for sub in ['O', 'R']:
        sub_path = waste_root / sub
        if sub_path.is_dir():
            _, sz, _ = count_images_in_dir(sub_path)
            waste_sizes.extend(sz)
    if waste_sizes:
        w = [s[0] for s in waste_sizes]
        h = [s[1] for s in waste_sizes]
        print(f'Waste image size range: width {min(w)}-{max(w)} px, height {min(h)}-{max(h)} px')

if __name__ == '__main__':
    main()
