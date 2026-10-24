import { useEffect, useRef } from 'react';
import { toCanvas } from 'qrcode';

export function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      void toCanvas(ref.current, value, { width: size, margin: 1 });
    }
  }, [value, size]);

  return <canvas ref={ref} className="rounded-lg border border-stone-200 bg-white" aria-label={`QR code for ${value}`} />;
}
