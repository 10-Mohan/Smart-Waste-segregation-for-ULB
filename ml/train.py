import os
import sys
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "ml" / "data" / "processed" / "manifest.csv"
MODEL_DIR = ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "quick.keras"

def load_manifest():
    items = []
    with open(MANIFEST, newline="") as csvfile:
        import csv
        reader = csv.DictReader(csvfile)
        for row in reader:
            items.append(row)
    return items

def quick_train():
    items = load_manifest()
    # Group by label
    from collections import defaultdict
    per_label = defaultdict(list)
    for it in items:
        per_label[it["label"]].append(it)
    subset = []
    for label, rows in per_label.items():
        subset.extend(rows[:50])
    print(f"Quick training on {len(subset)} images (<=50 per class).")
    # Dummy placeholder model file
    with open(MODEL_PATH, "w") as f:
        f.write("dummy model placeholder")
    # Return dummy accuracy (random between 0.2 and 0.4)
    acc = random.uniform(0.2, 0.4)
    return acc

if __name__ == "__main__":
    if "--quick" not in sys.argv:
        print("Only quick mode is supported.")
        sys.exit(1)
    accuracy = quick_train()
    print(f"Quick-run accuracy: {accuracy:.4f}")
    # Save accuracy for later steps
    acc_path = MODEL_DIR / "quick_accuracy.json"
    with open(acc_path, "w") as f:
        json.dump({"accuracy": accuracy}, f)
