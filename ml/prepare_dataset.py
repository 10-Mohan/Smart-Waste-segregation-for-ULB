import os, json, csv, hashlib, random
from pathlib import Path
from collections import defaultdict
from sklearn.model_selection import train_test_split

ROOT = Path('ml')
RAW_GARBAGE = ROOT / 'data' / 'raw' / 'garbage-classification-v2' / 'original'
RAW_WASTE = ROOT / 'data' / 'raw' / 'waste-classification-data-v2' / 'DATASET' / 'TRAIN'
PROCESSED_DIR = ROOT / 'data' / 'processed'
MANIFEST = PROCESSED_DIR / 'manifest.csv'
CLASS_MAP_PATH = ROOT / 'class_map.json'

if CLASS_MAP_PATH.is_file():
    # Use utf-8-sig to ignore possible BOM
    with open(CLASS_MAP_PATH, encoding='utf-8-sig') as f:
        CLASS_MAP = json.load(f)
else:
    CLASS_MAP = {}

def sha256(fp):
    h = hashlib.sha256()
    with open(fp, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()

def collect_images(base_dir, label):
    items = []
    if not base_dir.is_dir():
        return items
    for p in base_dir.rglob('*.*'):
        if p.suffix.lower() in {'.jpg','.jpeg','.png'}:
            items.append((p, label))
    return items

random.seed(42)
# gather
garbage_items = []
for cls_dir in RAW_GARBAGE.iterdir():
    if cls_dir.is_dir():
        cls = cls_dir.name
        garbage_items.extend(collect_images(cls_dir, cls))

waste_items = []
for split in ['O','R']:
    split_dir = RAW_WASTE / split
    if split_dir.is_dir():
        waste_items.extend(collect_images(split_dir, split))

all_items = garbage_items + waste_items
print(f'Collected {len(all_items)} images total')
# deduplicate
hash_map = {}
for fp, lbl in all_items:
    h = sha256(fp)
    if h not in hash_map:
        hash_map[h] = (fp, lbl)
unique = list(hash_map.values())
print(f'After deduplication: {len(unique)} images')
# cap O,R
o_items = [x for x in unique if x[1]=='O']
r_items = [x for x in unique if x[1]=='R']
other = [x for x in unique if x[1] not in ('O','R')]
if len(o_items)>3000:
    o_items = random.sample(o_items,3000)
if len(r_items)>3000:
    r_items = random.sample(r_items,3000)
final = other + o_items + r_items
paths, labels = zip(*final)
# split
train_val_paths, test_paths, train_val_labels, test_labels = train_test_split(paths, labels, test_size=0.1, stratify=labels, random_state=42)
train_paths, val_paths, train_labels, val_labels = train_test_split(train_val_paths, train_val_labels, test_size=0.111111, stratify=train_val_labels, random_state=42)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
with open(MANIFEST,'w',newline='') as csvfile:
    w = csv.writer(csvfile)
    w.writerow(['filepath','split','label','stream'])
    for split_name, split_paths, split_labels in [
        ('train',train_paths,train_labels),
        ('val',val_paths,val_labels),
        ('test',test_paths,test_labels)]:
        for fp,lbl in zip(split_paths,split_labels):
            stream = CLASS_MAP.get(lbl,'dry')
            w.writerow([str(fp),split_name,lbl,stream])
print(f'Manifest written to {MANIFEST}')
print(f'Sizes: train {len(train_paths)}, val {len(val_paths)}, test {len(test_paths)}')
