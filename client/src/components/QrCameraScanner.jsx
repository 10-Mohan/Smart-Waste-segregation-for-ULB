import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Button from './ui/Button.jsx';
import './QrCameraScanner.css';

export default function QrCameraScanner({ onScan, startLabel = 'Start camera' }) {
  const regionId = `qr-camera-${useId().replaceAll(':', '')}`;
  const scannerRef = useRef(null);
  const callbackRef = useRef(onScan);
  const acceptedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('Camera is stopped. Start it to scan a QR code.');

  callbackRef.current = onScan;

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // The browser may have already stopped the media stream.
    }
    try { scanner.clear(); } catch { /* Scanner markup may already be detached. */ }
    setRunning(false);
  }

  async function startScanner() {
    setMessage('Allow camera access to scan a QR code.');
    setStarting(true);
    acceptedRef.current = false;
    let timedOut = false;
    let timeoutId;

    try {
      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;
      const startPromise = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        async (decodedText) => {
          if (acceptedRef.current || timedOut) return;
          acceptedRef.current = true;
          navigator.vibrate?.(80);
          const code = decodedText.trim().toUpperCase();
          await stopScanner();
          callbackRef.current?.(code);
        },
        () => {},
      ).then(async () => {
        if (timedOut) {
          if (scanner.isScanning) await scanner.stop();
          try { scanner.clear(); } catch { /* The frame is already gone. */ }
          return;
        }
        setRunning(true);
        setMessage('Camera ready. Hold the QR code inside the frame.');
      });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          reject(new Error('Camera start timed out.'));
        }, 8000);
      });
      await Promise.race([startPromise, timeoutPromise]);
    } catch {
      timedOut = true;
      setRunning(false);
      setMessage('Camera unavailable or permission denied. Type the code below instead.');
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try { scanner?.clear(); } catch { /* Starting may not have created its view. */ }
    } finally {
      window.clearTimeout(timeoutId);
      setStarting(false);
    }
  }

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) scanner.stop().catch(() => {});
    try { scanner?.clear?.(); } catch { /* Ignore teardown after route change. */ }
  }, []);

  return (
    <div className="qr-camera">
      <div className="qr-camera__viewport" role="img" aria-label="Camera preview for scanning a QR code">
        <div id={regionId} />
        {!running && <p className="qr-camera__placeholder" aria-hidden="true">QR camera preview</p>}
      </div>
      <p className="qr-camera__message" aria-live="polite">{message}</p>
      <div className="qr-camera__controls">
        {!running
          ? <Button type="button" className="qr-camera__button" disabled={starting} onClick={startScanner}>{starting ? 'Starting camera…' : startLabel}</Button>
          : <Button type="button" className="qr-camera__button" variant="secondary" onClick={stopScanner}>Stop camera</Button>}
      </div>
      <p className="qr-camera__alternative">Camera frame for scanning a QR code. Manual code entry is also available.</p>
    </div>
  );
}