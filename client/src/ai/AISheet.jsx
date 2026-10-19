// client/src/ai/AISheet.jsx
import { useEffect, useRef, useState } from 'react';
import BottomSheet from '../pages/worker/BottomSheet.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { predictImage, predictTiles } from './classifier.js';
import { binCheckMode, identifyMode } from './decision.js';

const BINS = [['wet', 'Wet'], ['dry', 'Dry'], ['hazardous', 'Hazardous']];
const STATUS_LABEL = { segregated: 'Segregated', mixed: 'Mixed', rejected: 'Rejected' };
const MAX_SIDE = 1024;

const pct = (value) => `${Math.round(value * 100)}%`;

export default function AISheet({ onClose, onApply }) {
  const [mode, setMode] = useState('bin'); // 'bin' | 'identify'
  const [bin, setBin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Start the camera when the sheet opens; always stop it when the sheet closes.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not available here. Use Upload photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch {
        if (!cancelled) setCameraError('Camera unavailable or permission denied. You can still upload a photo.');
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function analyze(canvas) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (mode === 'bin') {
        if (!bin) {
          setError('Choose which bin you are checking first.');
          return;
        }
        const { tileProbs, labels, streamMap, decisionConfig } = await predictTiles(canvas);
        setResult({ kind: 'bin', ...binCheckMode({ tileProbs, labels, streamMap, decisionConfig, bin }) });
      } else {
        const { probs, labels, streamMap, decisionConfig } = await predictImage(canvas);
        setResult({ kind: 'identify', ...identifyMode({ probs, labels, streamMap, uncertainThreshold: decisionConfig.uncertainThreshold }) });
      }
    } catch (err) {
      console.error(err);
      setError('The AI check could not run. You can still log the pickup manually.');
    } finally {
      setBusy(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    analyze(canvas);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('unreadable image'));
        image.src = url;
      });
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      await analyze(canvas);
    } catch {
      setError("That file couldn't be read as an image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function useSuggestion() {
    const status = result.decision;
    const note = `AI: ${STATUS_LABEL[status]}, ${pct(result.confidence)} confident${result.reasonText ? ` - ${result.reasonText}` : ''}`;
    onApply({
      status,
      reason: result.reason || '',
      reasonText: result.reasonText || '',
      note,
      confidence: Math.round(result.confidence * 100),
    });
  }

  const canRun = !busy && (mode === 'identify' || Boolean(bin));

  return (
    <BottomSheet title="Check with AI" onClose={onClose}>
      <div className="worker-reason-list" role="group" aria-label="AI mode">
        <button className="worker-reason-chip" type="button" aria-pressed={mode === 'bin'} onClick={() => { setMode('bin'); setResult(null); setError(''); }}>
          Bin check
        </button>
        <button className="worker-reason-chip" type="button" aria-pressed={mode === 'identify'} onClick={() => { setMode('identify'); setResult(null); setError(''); }}>
          Identify item
        </button>
      </div>

      {mode === 'bin' && (
        <>
          <p className="worker-help">Which bin are you checking?</p>
          <div className="worker-reason-list" role="group" aria-label="Bin being checked">
            {BINS.map(([value, label]) => (
              <button key={value} className="worker-reason-chip" type="button" aria-pressed={bin === value} onClick={() => { setBin(value); setResult(null); setError(''); }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxHeight: '240px', borderRadius: '8px', background: '#102a22', display: cameraReady ? 'block' : 'none' }}
      />
      {cameraError && <p className="worker-help">{cameraError}</p>}

      <div className="worker-stack-sm">
        <Button className="worker-touch-button" onClick={capture} disabled={!canRun || !cameraReady}>Capture photo</Button>
        <label className="worker-link-button" style={{ cursor: canRun ? 'pointer' : 'not-allowed', opacity: canRun ? 1 : 0.5 }}>
          Upload photo
          <input type="file" accept="image/*" onChange={handleFile} disabled={!canRun} style={{ display: 'none' }} />
        </label>
      </div>

      {busy && <Spinner label="Analysing photo (the first time takes a few seconds)" />}
      {error && <p className="worker-error" role="alert">{error}</p>}

      {result && result.kind === 'identify' && (
        result.status === 'unknown'
          ? <p className="worker-help" role="status">{result.message}</p>
          : (
            <div className="worker-stack-sm" role="status">
              <p><strong>{result.label}</strong> ({pct(result.confidence)}) - {result.stream} waste</p>
              <p className="worker-help">
                {result.bin ? `Belongs in the ${result.bin} bin.` : 'General/mixed waste - not for a segregated bin.'}
              </p>
              <ul className="worker-list">
                {result.top3.map((item) => (
                  <li key={item.label} className="worker-help">{item.label} - {item.stream} - {pct(item.prob)}</li>
                ))}
              </ul>
            </div>
          )
      )}

      {result && result.kind === 'bin' && (
        result.decision === 'unknown'
          ? <p className="worker-help" role="status">{result.message}</p>
          : (
            <div className="worker-stack-sm" role="status">
              <p><strong>AI suggests: {STATUS_LABEL[result.decision]}</strong> ({pct(result.confidence)} confident)</p>
              <p className="worker-help">
                {pct(result.contaminationRatio)} of the clear parts of the photo look wrong for a {result.bin} bin
                {result.reasonText ? ` - ${result.reasonText}.` : '.'}
              </p>
              <Button className="worker-touch-button" onClick={useSuggestion}>Use this suggestion</Button>
              <p className="worker-help">You will still confirm the final status yourself.</p>
            </div>
          )
      )}

      <p className="worker-help">
        The AI recognises wet, dry and hazardous (battery) waste only. E-waste, sanitary and biomedical waste must be judged manually. Photos are never saved.
      </p>
    </BottomSheet>
  );
}
