import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface QrCodeCardProps {
  url: string;
  username: string;
  fgColor?: string;
  bgColor?: string;
  compact?: boolean;
}

export function QrCodeCard({
  url,
  username,
  fgColor = '#141413',
  bgColor = '#FFFFFF',
  compact = false,
}: QrCodeCardProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [pngDataUrl, setPngDataUrl] = useState<string>('');

  const safeFg = fgColor.startsWith('#') ? fgColor : '#141413';
  const safeBg = bgColor.startsWith('#') ? bgColor : '#FFFFFF';

  useEffect(() => {
    let active = true;
    QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      width: 240,
      color: {
        dark: safeFg,
        light: safeBg,
      },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {});

    QRCode.toDataURL(url, {
      margin: 2,
      width: 512,
      color: {
        dark: safeFg,
        light: safeBg,
      },
    })
      .then((dataUrl) => {
        if (active) setPngDataUrl(dataUrl);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [url, safeFg, safeBg]);

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `lokabio-${username}-qr.svg`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement('a');
    a.href = pngDataUrl;
    a.download = `lokabio-${username}-qr.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`${
          compact ? 'w-44 h-44' : 'w-48 h-48'
        } rounded-2xl border border-stone-200 overflow-hidden bg-white p-2 shadow-xs flex items-center justify-center`}
      >
        {pngDataUrl ? (
          <img
            src={pngDataUrl}
            alt={`QR Code untuk /${username}`}
            className="w-full h-full object-contain rounded-xl"
          />
        ) : (
          <div className="w-full h-full bg-stone-100 animate-pulse rounded-xl" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={!pngDataUrl}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh PNG</span>
        </button>
        <button
          type="button"
          onClick={handleDownloadSvg}
          disabled={!svgMarkup}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-[#141413] text-xs font-medium hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh SVG</span>
        </button>
      </div>
    </div>
  );
}
