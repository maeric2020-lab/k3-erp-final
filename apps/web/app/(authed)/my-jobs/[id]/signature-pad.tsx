'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface Props {
  jobId: string;
  onSubmit: (paths: { technician: string; customer?: string; customerName?: string }) => Promise<void>;
  onClose: () => void;
}

/**
 * Touch+mouse signature pad. Two pads stacked: technician (required), customer (optional).
 * Each is rendered as a canvas, then exported as PNG and uploaded to /api/signatures.
 */
export function SignaturePad({ jobId, onSubmit, onClose }: Props) {
  const t = useTranslations();
  const techRef = useRef<HTMLCanvasElement | null>(null);
  const custRef = useRef<HTMLCanvasElement | null>(null);
  const [techHasInk, setTechHasInk] = useState(false);
  const [custHasInk, setCustHasInk] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    [techRef.current, custRef.current].forEach((c) => {
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    });
  }, []);

  const bind = (canvas: HTMLCanvasElement | null, setHasInk: (b: boolean) => void) => {
    if (!canvas) return;
    let drawing = false;
    let last: { x: number; y: number } | null = null;

    const pos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const t = (e as TouchEvent).touches?.[0];
      const cx = t ? t.clientX : (e as MouseEvent).clientX;
      const cy = t ? t.clientY : (e as MouseEvent).clientY;
      return {
        x: ((cx - rect.left) * canvas.width) / rect.width,
        y: ((cy - rect.top) * canvas.height) / rect.height,
      };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing = true;
      last = pos(e);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return;
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx || !last) return;
      const cur = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      last = cur;
      setHasInk(true);
    };
    const end = () => { drawing = false; last = null; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  };

  useEffect(() => {
    bind(techRef.current, setTechHasInk);
    bind(custRef.current, setCustHasInk);
    // No cleanup needed — canvas elements unmount with the modal
  }, []);

  const clear = (ref: React.RefObject<HTMLCanvasElement>, setHasInk: (b: boolean) => void) => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const exportPng = (ref: React.RefObject<HTMLCanvasElement>): Promise<Blob | null> =>
    new Promise((resolve) => ref.current?.toBlob((b) => resolve(b), 'image/png'));

  const upload = async (blob: Blob, kind: 'technician' | 'customer'): Promise<string> => {
    const fd = new FormData();
    fd.append('file', blob, `${kind}.png`);
    fd.append('job_id', jobId);
    fd.append('kind', kind);
    const res = await fetch('/api/signatures/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `${res.status}`);
    }
    const body = await res.json();
    return body.path as string;
  };

  const submit = async () => {
    setError(null);
    if (!techHasInk) { setError('Technician signature is required'); return; }
    setSubmitting(true);
    try {
      const techBlob = await exportPng(techRef);
      if (!techBlob) throw new Error('Failed to capture technician signature');
      const techPath = await upload(techBlob, 'technician');

      let custPath: string | undefined;
      if (custHasInk) {
        const cBlob = await exportPng(custRef);
        if (cBlob) custPath = await upload(cBlob, 'customer');
      }

      await onSubmit({
        technician: techPath,
        customer: custPath,
        customerName: customerName.trim() || undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">{t('operations.jobs.signatures')}</h3>
          <button onClick={onClose} className="p-1 -m-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label required>{t('operations.jobs.technicianSignature')}</Label>
              <button onClick={() => clear(techRef, setTechHasInk)} className="text-xs text-gray-500 hover:text-gray-800">
                {t('operations.jobs.clearSignature')}
              </button>
            </div>
            <canvas
              ref={techRef}
              width={600}
              height={180}
              className="w-full border border-gray-300 rounded-lg bg-white touch-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t('operations.jobs.customerSignature')} ({t('common.optional')})</Label>
              <button onClick={() => clear(custRef, setCustHasInk)} className="text-xs text-gray-500 hover:text-gray-800">
                {t('operations.jobs.clearSignature')}
              </button>
            </div>
            <canvas
              ref={custRef}
              width={600}
              height={180}
              className="w-full border border-gray-300 rounded-lg bg-white touch-none"
            />
          </div>

          <div>
            <Label htmlFor="customer_name">{t('operations.jobs.customerSignatureName')}</Label>
            <Input id="customer_name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting || !techHasInk}>
            {submitting ? t('common.loading') : t('operations.jobs.saveSignature')}
          </Button>
        </div>
      </div>
    </div>
  );
}
