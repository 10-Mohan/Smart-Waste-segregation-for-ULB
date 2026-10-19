// client/src/ai/classifier.js
// Loads the TF.js graph model once and runs predictions on a canvas / image / video element.
// Model facts: input [N,224,224,3] float32 with pixel values 0-255 (NO /255 - rescaling is inside the model),
// output softmax over the 12 classes listed in labels.json.

const BASE = '/models/waste-v1';
const SIZE = 224;
let resourcesPromise = null;

export function loadResources() {
  if (!resourcesPromise) {
    resourcesPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      const [model, labels, streamMap, decisionConfig] = await Promise.all([
        tf.loadGraphModel(`${BASE}/model.json`),
        fetch(`${BASE}/labels.json`).then((r) => r.json()),
        fetch(`${BASE}/stream_map.json`).then((r) => r.json()),
        fetch(`${BASE}/decision_config.json`).then((r) => r.json()),
      ]);
      return { tf, model, labels, streamMap, decisionConfig };
    })().catch((error) => {
      resourcesPromise = null; // allow a retry after a failed load
      throw error;
    });
  }
  return resourcesPromise;
}

function firstTensor(output) {
  if (Array.isArray(output)) return output[0];
  if (output && typeof output.array === 'function') return output;
  return Object.values(output)[0];
}

async function runBatch(tf, model, batch) {
  const out = firstTensor(model.predict(batch));
  const rows = await out.array();
  tf.dispose([batch, out]);
  return rows;
}

/** Classify the whole picture (stretched to 224x224). */
export async function predictImage(source) {
  const { tf, model, labels, streamMap, decisionConfig } = await loadResources();
  const batch = tf.tidy(() => (
    tf.image.resizeBilinear(tf.browser.fromPixels(source), [SIZE, SIZE]).toFloat().expandDims(0)
  ));
  const rows = await runBatch(tf, model, batch);
  return { probs: rows[0], labels, streamMap, decisionConfig };
}

/** Classify a 3x3 grid of tiles in one batch. Returns one probability array per tile. */
export async function predictTiles(source, grid = 3) {
  const { tf, model, labels, streamMap, decisionConfig } = await loadResources();
  const batch = tf.tidy(() => {
    const raw = tf.browser.fromPixels(source);
    const [height, width] = raw.shape;
    const th = Math.floor(height / grid);
    const tw = Math.floor(width / grid);
    const tiles = [];
    for (let r = 0; r < grid; r += 1) {
      for (let c = 0; c < grid; c += 1) {
        const tile = tf.slice(raw, [r * th, c * tw, 0], [th, tw, 3]);
        tiles.push(tf.image.resizeBilinear(tile, [SIZE, SIZE]).toFloat());
      }
    }
    return tf.stack(tiles);
  });
  const tileProbs = await runBatch(tf, model, batch);
  return { tileProbs, labels, streamMap, decisionConfig };
}