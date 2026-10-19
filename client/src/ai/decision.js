// client/src/ai/decision.js
// Pure decision logic for the "Check with AI" feature. No TensorFlow here, so it is easy to test.

/** Tunable constants */
export const MIN_CONFIDENT_TILES = 3;
export const CONTAM_LOW = 0.15;   // below this share of wrong-stream tiles -> Segregated
export const CONTAM_HIGH = 0.4;   // above this share -> Rejected (between -> Mixed)
export const CANT_TELL = "Can't tell - check manually";

/** Must match the rejection reasons offered in ScanTab.jsx */
export const REASON_FOOD_IN_DRY = 'Food waste in dry bin';
export const REASON_PLASTIC_IN_WET = 'Plastic in wet bin';
export const REASON_HAZARDOUS_IN_DRY = 'Hazardous items in dry bin';
export const REASON_OTHER = 'Other';

const STREAM_NAMES = { wet: 'wet', dry: 'dry', hazardous: 'hazardous', mixed: 'general/mixed' };

function topIndex(probs) {
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
  return best;
}

/** Which bin a stream belongs in (null for general/mixed or unknown streams). */
export function streamToBin(stream) {
  return stream === 'wet' || stream === 'dry' || stream === 'hazardous' ? stream : null;
}

/** Map "wrong stream found in this bin" to one of the existing rejection reasons when it fits. */
export function reasonFor(bin, wrongStream) {
  const wrongName = STREAM_NAMES[wrongStream] || wrongStream;
  if (bin === 'dry' && wrongStream === 'wet') {
    return { reason: REASON_FOOD_IN_DRY, reasonText: 'wet/food waste found in dry bin' };
  }
  if (bin === 'wet' && wrongStream === 'dry') {
    return { reason: REASON_PLASTIC_IN_WET, reasonText: 'dry waste (plastic, paper, glass, etc.) found in wet bin' };
  }
  if (bin === 'dry' && wrongStream === 'hazardous') {
    return { reason: REASON_HAZARDOUS_IN_DRY, reasonText: 'hazardous items (batteries) found in dry bin' };
  }
  return { reason: REASON_OTHER, reasonText: `${wrongName} waste found in ${bin} bin` };
}

/**
 * Identify-item mode: one probability array for the whole photo.
 * Returns {status:'unknown'|'identified', ...}.
 */
export function identifyMode({ probs, labels, streamMap, uncertainThreshold = 0.6 }) {
  const top = topIndex(probs);
  if (!(probs[top] >= uncertainThreshold)) {
    return { status: 'unknown', message: CANT_TELL };
  }
  const label = labels[top];
  const stream = streamMap[label] || 'unknown';
  const top3 = probs
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3)
    .map(({ p, i }) => ({ label: labels[i], stream: streamMap[labels[i]] || 'unknown', prob: p }));
  return {
    status: 'identified',
    label,
    stream,
    bin: streamToBin(stream),
    confidence: probs[top],
    top3,
  };
}

/**
 * Bin-check mode: one probability array per tile (3x3 grid = 9 tiles).
 * `bin` is the bin the worker is checking: 'wet' | 'dry' | 'hazardous'.
 * Returns {decision:'segregated'|'mixed'|'rejected'|'unknown', confidence, contaminationRatio, ...}.
 */
export function binCheckMode({ tileProbs, labels, streamMap, decisionConfig, bin }) {
  const threshold = decisionConfig?.uncertainThreshold ?? 0.6;
  const accepted = decisionConfig?.acceptedStreamsByBin?.[bin];
  if (!accepted) return { decision: 'unknown', message: 'Choose which bin you are checking first.' };

  const confident = [];
  for (const probs of tileProbs) {
    const top = topIndex(probs);
    const stream = streamMap[labels[top]];
    if (probs[top] >= threshold && stream) confident.push({ stream, prob: probs[top] });
  }
  if (confident.length < MIN_CONFIDENT_TILES) {
    return {
      decision: 'unknown',
      message: `${CANT_TELL}. Try a closer, better-lit photo.`,
      confidentTiles: confident.length,
    };
  }

  const wrong = confident.filter((t) => !accepted.includes(t.stream));
  const contaminationRatio = wrong.length / confident.length;
  let decision = 'segregated';
  if (contaminationRatio > CONTAM_HIGH) decision = 'rejected';
  else if (contaminationRatio >= CONTAM_LOW) decision = 'mixed';

  const counts = {};
  for (const t of wrong) counts[t.stream] = (counts[t.stream] || 0) + 1;
  const mainWrongStream = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
  const reasonInfo = decision !== 'segregated' && mainWrongStream ? reasonFor(bin, mainWrongStream) : {};

  return {
    decision,
    bin,
    confidence: confident.reduce((sum, t) => sum + t.prob, 0) / confident.length, // average model certainty
    contaminationRatio,
    confidentTiles: confident.length,
    mainWrongStream,
    reason: reasonInfo.reason || '',
    reasonText: reasonInfo.reasonText || '',
  };
}