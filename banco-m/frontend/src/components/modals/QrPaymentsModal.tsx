import React, { useEffect, useRef, useState } from 'react';
import { useBanking } from '../../context/BankingContext';

type QrKind = 'COMERCIO' | 'ARCA' | 'ARBA' | 'MUNICIPALIDAD';
type NativeQrDetector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type NativeQrDetectorConstructor = new (options: { formats: string[] }) => NativeQrDetector;

export const QrPaymentsModal: React.FC = () => {
  const { isQrModalOpen, setIsQrModalOpen, cuit, user, createQr, registerCommerce, payQr, getQrStatus, copyToClipboard } = useBanking();
  const [mode, setMode] = useState<'pay' | 'generate'>('pay');
  const [qrInput, setQrInput] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationType, setDestinationType] = useState<'CUIT' | 'CBU'>('CUIT');
  const [kind, setKind] = useState<QrKind>('COMERCIO');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [paymentQr, setPaymentQr] = useState<Awaited<ReturnType<typeof createQr>>>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisteringCommerce, setIsRegisteringCommerce] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isScanning) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let animationFrame = 0;

    const scan = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: NativeQrDetectorConstructor }).BarcodeDetector;
      if (!Detector) throw new Error('Este navegador no ofrece lectura QR con cámara. Pegá el payload o el pagoId.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere localhost o una conexión HTTPS.');

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      const video = videoRef.current;
      if (!video) throw new Error('No se pudo iniciar la vista de cámara.');
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ['qr_code'] });

      const readFrame = async () => {
        if (cancelled) return;
        try {
          const [code] = await detector.detect(video);
          if (code?.rawValue) {
            setQrInput(code.rawValue);
            setScanMessage('Código leído. Revisá el pago y confirmá para debitar la cuenta.');
            setIsScanning(false);
            return;
          }
        } catch {
          setScanMessage('No se pudo leer el código. Podés pegar el payload manualmente.');
          setIsScanning(false);
          return;
        }
        animationFrame = requestAnimationFrame(() => void readFrame());
      };
      void readFrame();
    };

    scan().catch((error: unknown) => {
      setScanMessage(error instanceof Error ? error.message : 'No se pudo abrir la cámara.');
      setIsScanning(false);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [isScanning]);

  if (!isQrModalOpen) return null;

  const close = () => {
    setIsScanning(false);
    setIsQrModalOpen(false);
    setStatus(null);
  };

  const resolvePagoId = (value: string) => {
    const trimmed = value.trim();
    try {
      const payload = JSON.parse(trimmed) as { pagoId?: string };
      if (payload.pagoId) return payload.pagoId;
    } catch {
      // También se puede ingresar directamente el pagoId.
    }
    return trimmed;
  };

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    const pagoId = resolvePagoId(qrInput);
    if (!pagoId) return;
    setIsSubmitting(true);
    setStatus(null);
    const paid = await payQr(pagoId);
    if (paid) {
      const result = await getQrStatus(pagoId);
      setStatus(result?.estado || 'PAGADO');
      setQrInput(pagoId);
    }
    setIsSubmitting(false);
  };

  const handleCheckStatus = async () => {
    const pagoId = resolvePagoId(qrInput);
    if (!pagoId) return;
    setIsSubmitting(true);
    const result = await getQrStatus(pagoId);
    setStatus(result?.estado || null);
    setIsSubmitting(false);
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!destination.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setIsSubmitting(true);
    setPaymentQr(null);
    const result = await createQr(destination, destinationType, kind, numericAmount, description, reference);
    setPaymentQr(result);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in" onClick={close}>
      <section className="w-full max-w-lg rounded-2xl bg-surface-container p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40 max-h-[92vh] overflow-y-auto no-scrollbar" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Pagos QR</h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Conectado a banco-m</span>
            </div>
          </div>
          <button aria-label="Cerrar pagos QR" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" onClick={close}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-1">
          <button type="button" onClick={() => { setMode('pay'); setStatus(null); }} className={`py-2.5 rounded-lg font-label-md text-label-md ${mode === 'pay' ? 'bg-primary text-on-primary font-semibold' : 'text-on-surface-variant'}`}>Pagar QR</button>
          <button type="button" onClick={() => { setMode('generate'); setStatus(null); }} className={`py-2.5 rounded-lg font-label-md text-label-md ${mode === 'generate' ? 'bg-primary text-on-primary font-semibold' : 'text-on-surface-variant'}`}>Generar QR</button>
        </div>

        {mode === 'pay' ? (
          <form onSubmit={handlePay} className="flex flex-col gap-4">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Pegá el identificador del pago o el contenido del QR escaneado. El débito se registra en tu cuenta activa.</p>
            <button type="button" onClick={() => { setScanMessage(null); setIsScanning((active) => !active); }} className="self-start px-3 py-2 rounded-lg bg-surface-container-high text-primary font-label-md text-label-md flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              {isScanning ? 'Detener cámara' : 'Escanear con cámara'}
            </button>
            {isScanning && <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-64 rounded-xl bg-black object-cover" />}
            {scanMessage && <p className="font-body-sm text-body-sm text-on-surface-variant">{scanMessage}</p>}
            <label className="flex flex-col gap-1.5 font-label-md text-label-md text-on-surface-variant">
              Pago ID o payload QR
              <textarea required rows={3} value={qrInput} onChange={(event) => setQrInput(event.target.value)} placeholder="pqr_… o pegá el payload leído" className="resize-y rounded-lg bg-surface-container-lowest px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none" />
            </label>
            {status && <div className="rounded-lg bg-tertiary-container/20 px-3 py-2 text-tertiary font-label-md text-label-md">Estado consultado: {status}</div>}
            <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-on-primary py-3 rounded-xl font-label-lg text-label-lg font-semibold disabled:opacity-60">
              {isSubmitting ? 'Procesando en banco-m…' : 'Pagar desde mi cuenta'}
            </button>
            <button type="button" disabled={isSubmitting || !qrInput.trim()} onClick={() => void handleCheckStatus()} className="w-full bg-surface-container-high text-primary py-2.5 rounded-xl font-label-md text-label-md disabled:opacity-50">
              Consultar estado del pago
            </button>
          </form>
        ) : (
          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <p className="font-body-sm text-body-sm text-on-surface-variant">El QR vence en 15 minutos. Para tipo Comercio, la cuenta destino debe tener un comercio registrado.</p>
            {kind === 'COMERCIO' && <button type="button" disabled={isRegisteringCommerce} onClick={async () => {
              setIsRegisteringCommerce(true);
              const registered = await registerCommerce();
              setIsRegisteringCommerce(false);
              if (registered) {
                setDestinationType('CUIT');
                setDestination(cuit);
              }
            }} className="self-start px-3 py-2 rounded-lg bg-surface-container-high text-primary font-label-md text-label-md disabled:opacity-60">
              {isRegisteringCommerce ? 'Registrando…' : `Registrar ${user.name} como comercio`}
            </button>}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">Identificador destino
                <select value={destinationType} onChange={(event) => setDestinationType(event.target.value as 'CUIT' | 'CBU')} className="rounded-lg bg-surface-container-lowest px-3 py-2.5 text-on-surface">
                  <option value="CUIT">CUIT</option><option value="CBU">CBU</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">Tipo de cobro
                <select value={kind} onChange={(event) => setKind(event.target.value as QrKind)} className="rounded-lg bg-surface-container-lowest px-3 py-2.5 text-on-surface">
                  <option value="COMERCIO">Comercio</option><option value="ARCA">ARCA</option><option value="ARBA">ARBA</option><option value="MUNICIPALIDAD">Municipalidad</option>
                </select>
              </label>
            </div>
            <input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={destinationType === 'CBU' ? 'CBU destino de 22 dígitos' : 'CUIT destino'} className="rounded-lg bg-surface-container-lowest px-3 py-3 text-on-surface placeholder:text-outline focus:outline-none" />
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monto en ARS" className="rounded-lg bg-surface-container-lowest px-3 py-3 text-on-surface placeholder:text-outline focus:outline-none" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción o referencia" className="rounded-lg bg-surface-container-lowest px-3 py-3 text-on-surface placeholder:text-outline focus:outline-none" />
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia de impuesto o factura (opcional)" className="rounded-lg bg-surface-container-lowest px-3 py-3 text-on-surface placeholder:text-outline focus:outline-none" />
            <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-on-primary py-3 rounded-xl font-label-lg text-label-lg font-semibold disabled:opacity-60">
              {isSubmitting ? 'Generando…' : 'Generar código QR'}
            </button>
            {paymentQr && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-low p-4 text-center">
                <img src={paymentQr.qrCode} alt="Código QR de pago" className="w-52 h-52 rounded-lg bg-white p-2" />
                <span className="font-label-md text-label-md text-on-surface">Pago {paymentQr.pagoId}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">${Number(paymentQr.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · vence {new Date(paymentQr.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                <button type="button" onClick={() => copyToClipboard(paymentQr.qrPayload, 'Payload QR')} className="px-3 py-2 rounded-lg bg-surface-container-high text-primary font-label-md text-label-md">Copiar payload</button>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
};
