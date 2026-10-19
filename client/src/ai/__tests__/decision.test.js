import { describe, expect, it } from 'vitest';
import { binCheckMode, identifyMode, reasonFor, streamToBin } from '../decision.js';

const labels = ['O', 'battery', 'paper', 'trash'];
const streamMap = { O: 'wet', battery: 'hazardous', paper: 'dry', trash: 'mixed' };
const decisionConfig = {
  uncertainThreshold: 0.6,
  acceptedStreamsByBin: { wet: ['wet'], dry: ['dry'], hazardous: ['hazardous'] },
};
const tile = (label, p = 0.9) => labels.map((l) => (l === label ? p : (1 - p) / 3));
const run = (tiles, bin) => binCheckMode({ tileProbs: tiles, labels, streamMap, decisionConfig, bin });
const nine = (good, bad, badLabel = 'paper') => [
  ...Array(good).fill(tile('O')),
  ...Array(bad).fill(tile(badLabel)),
  ...Array(9 - good - bad).fill(labels.map(() => 0.25)), // unsure tiles
];

describe('binCheckMode', () => {
  it('clean bin is Segregated', () => {
    const r = run(nine(9, 0), 'wet');
    expect(r.decision).toBe('segregated');
    expect(r.contaminationRatio).toBe(0);
  });
  it('1 wrong tile out of 9 (11%) is still Segregated', () => {
    expect(run(nine(8, 1), 'wet').decision).toBe('segregated');
  });
  it('2-3 wrong tiles is Mixed', () => {
    expect(run(nine(7, 2), 'wet').decision).toBe('mixed');
    expect(run(nine(6, 3), 'wet').decision).toBe('mixed');
  });
  it('more than 40% wrong is Rejected', () => {
    expect(run(nine(5, 4), 'wet').decision).toBe('rejected');
  });
  it('maps wrong stream to an existing rejection reason', () => {
    const r = run(nine(4, 5), 'wet');
    expect(r.reason).toBe('Plastic in wet bin');
    expect(r.mainWrongStream).toBe('dry');
  });
  it('hazardous bin accepts only hazardous', () => {
    const tiles = [...Array(5).fill(tile('battery')), ...Array(4).fill(tile('O'))];
    expect(run(tiles, 'hazardous').decision).toBe('rejected');
  });
  it('general/mixed waste counts as wrong everywhere', () => {
    const r = run(nine(0, 9, 'trash'), 'dry');
    expect(r.decision).toBe('rejected');
    expect(r.reason).toBe('Other');
  });
  it("says can't tell with fewer than 3 confident tiles", () => {
    expect(run(nine(2, 0), 'wet').decision).toBe('unknown');
  });
  it('needs a bin to be chosen', () => {
    expect(run(nine(9, 0), '').decision).toBe('unknown');
  });
});

describe('identifyMode', () => {
  it('identifies a confident item and its bin', () => {
    const r = identifyMode({ probs: tile('paper', 0.8), labels, streamMap, uncertainThreshold: 0.6 });
    expect(r.status).toBe('identified');
    expect(r.label).toBe('paper');
    expect(r.bin).toBe('dry');
    expect(r.top3).toHaveLength(3);
  });
  it('says unknown below the threshold', () => {
    const r = identifyMode({ probs: [0.3, 0.3, 0.2, 0.2], labels, streamMap, uncertainThreshold: 0.6 });
    expect(r.status).toBe('unknown');
  });
  it('general/mixed items have no bin', () => {
    expect(identifyMode({ probs: tile('trash', 0.9), labels, streamMap }).bin).toBeNull();
  });
});

describe('helpers', () => {
  it('streamToBin', () => {
    expect(streamToBin('wet')).toBe('wet');
    expect(streamToBin('mixed')).toBeNull();
  });
  it('reasonFor falls back to Other', () => {
    expect(reasonFor('hazardous', 'wet').reason).toBe('Other');
  });
});