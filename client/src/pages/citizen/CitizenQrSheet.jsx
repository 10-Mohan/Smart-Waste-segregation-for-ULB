import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Button from '../../components/ui/Button.jsx';
import BottomSheet from '../worker/BottomSheet.jsx';

export function downloadQr(canvasRef, code) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${code}.png`;
  link.click();
}

export function printCitizenQr() {
  const clearPrintMode = () => document.body.classList.remove('citizen-print-mode');
  document.body.classList.add('citizen-print-mode');
  window.addEventListener('afterprint', clearPrintMode, { once: true });
  window.print();
}

export function QrLabel({ code, firstName, wardName, canvasRef, size = 240 }) {
  return (
    <div className="citizen-qr-label">
      <QRCodeCanvas ref={canvasRef} value={code} size={size} level="M" includeMargin aria-label={`QR code ${code}`} />
      <p className="citizen-qr-label__code">{code}</p>
      {firstName && <p className="citizen-qr-label__name">{firstName}</p>}
      {wardName && <p className="citizen-qr-label__ward">{wardName}</p>}
    </div>
  );
}

export default function CitizenQrSheet({ code, firstName, wardName, onClose }) {
  const canvasRef = useRef(null);
  return (
    <BottomSheet title="Your household QR" onClose={onClose} className="citizen-qr-sheet">
      <div className="citizen-print-label"><QrLabel code={code} firstName={firstName} wardName={wardName} canvasRef={canvasRef} /></div>
      <div className="citizen-qr-actions no-print">
        <Button className="citizen-touch-button" variant="secondary" onClick={() => downloadQr(canvasRef, code)}>Download QR</Button>
        <Button className="citizen-touch-button" onClick={printCitizenQr}>Print label</Button>
      </div>
    </BottomSheet>
  );
}