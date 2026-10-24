import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchIdMatchesShortCode, isValidShortCode } from '@sachbazaar/shared';
import { fetchBatches } from '../lib/api';
import { addRecent, clearRecent, getRecent } from '../lib/recent';
import type { DemoBatch } from '../lib/types';
import { stageLabel } from '../components/StageTimeline';

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
  }
}

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [demoBatches, setDemoBatches] = useState<DemoBatch[]>([]);
  const [recents, setRecents] = useState<DemoBatch[]>(getRecent());

  useEffect(() => {
    fetchBatches()
      .then(setDemoBatches)
      .catch(() => setDemoBatches([]));
  }, []);

  const resolve = useCallback(
    (raw: string) => {
      const value = raw.trim();
      setError(null);
      if (HEX32.test(value)) {
        navigate(`/trace/${value}`);
        return;
      }
      if (isValidShortCode(value)) {
        const match = [...demoBatches, ...recents].find((b) => batchIdMatchesShortCode(b.batchId, value));
        if (match) {
          navigate(`/trace/${match.batchId}`);
        } else {
          setError('Short code not recognised on this device. Enter the full 0x… batch ID.');
        }
        return;
      }
      setError('Enter a full batch ID (0x…) or a 13-character short code.');
    },
    [demoBatches, navigate, recents],
  );

  const openBatch = (batch: DemoBatch) => {
    addRecent(batch);
    navigate(`/trace/${batch.batchId}`);
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold sm:text-3xl">Trace a tomato batch</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Scan the QR code on the crate sticker or enter the batch short code to follow its journey from farm gate to mandi —
          every hop verified against the on-chain hash chain.
        </p>
        <form
          className="mx-auto mt-6 flex max-w-lg gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            resolve(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. K7M2QXA… or 0x…full batch id"
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 font-mono text-sm uppercase focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
            aria-label="Batch short code or ID"
          />
          <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
            Trace
          </button>
        </form>
        <QrScannerButton onDetected={(code) => resolve(code)} />
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </section>

      {demoBatches.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-stone-500 uppercase">Demo batches</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {demoBatches.map((b) => (
              <button
                key={b.batchId}
                onClick={() => openBatch(b)}
                className="rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-400 hover:shadow"
              >
                <span className="font-mono text-lg font-bold">{b.shortCode}</span>
                <span className="mt-1 block text-xs text-stone-500">{stageLabel(b.stage)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recents.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">Recently viewed</h2>
            <button
              className="text-xs text-stone-400 underline hover:text-stone-600"
              onClick={() => {
                clearRecent();
                setRecents([]);
              }}
            >
              clear
            </button>
          </div>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {recents.map((b) => (
              <li key={b.batchId}>
                <button onClick={() => openBatch(b)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
                  <span className="font-mono text-sm font-semibold">{b.shortCode}</span>
                  <span className="text-xs text-stone-500">{stageLabel(b.stage)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QrScannerButton({ onDetected }: { onDetected: (code: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  if (!('BarcodeDetector' in window)) {
    return null;
  }

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector!({ formats: ['qr_code'] });
      timerRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const match = raw.match(/0x[0-9a-fA-F]{64}/);
            stop();
            onDetected(match ? match[0] : raw);
          }
        } catch {
          /* transient decode errors are expected between frames */
        }
      }, 400);
    } catch {
      setError('Camera unavailable — enter the code manually.');
      stop();
    }
  };

  return (
    <div className="mt-4">
      {!scanning ? (
        <button type="button" onClick={() => void start()} className="text-sm font-medium text-orange-700 underline hover:text-orange-800">
          Scan QR code with camera
        </button>
      ) : (
        <div className="mx-auto mt-3 w-fit">
          <video ref={videoRef} className="h-40 w-40 rounded-lg border border-stone-300 object-cover" muted playsInline />
          <button type="button" onClick={stop} className="mt-2 text-xs text-stone-500 underline">
            stop scanning
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
