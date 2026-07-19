import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Room invite panel: join code + copy link + WhatsApp + QR.
// The link/QR carry the code, so they act as the "key" to the room — no typing.
export default function Share({ code }) {
  const [copied, setCopied] = useState('');
  const [showQr, setShowQr] = useState(false);
  const joinUrl = `${location.origin}/?room=${code}`;
  const shareText = `Join my Team Taboo game! Tap to enter (code ${code}): ${joinUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(label);
    setTimeout(() => setCopied(''), 1400);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Team Taboo', text: shareText, url: joinUrl });
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  };

  return (
    <div className="card p-4">
      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sand/40">Room code</div>
        <button
          onClick={() => copy(code, 'code')}
          className="mt-1 font-display text-5xl tracking-[0.15em] text-brass-bright transition active:scale-95"
          style={{ textShadow: '0 0 26px rgba(232,163,61,0.4)' }}
          title="Tap to copy"
        >
          {code}
        </button>
        <div className="h-4 text-xs text-mint">{copied === 'code' ? 'Code copied!' : ''}</div>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-2">
        <button onClick={() => copy(joinUrl, 'link')} className="btn-ghost py-3 text-sm">
          {copied === 'link' ? '✓ Copied' : '🔗 Link'}
        </button>
        {canNativeShare ? (
          <button
            onClick={nativeShare}
            className="btn py-3 text-sm text-night-950"
            style={{ backgroundImage: 'linear-gradient(135deg,#25d366,#128c7e)', boxShadow: '0 8px 24px -8px rgba(37,211,102,0.6)' }}
          >
            📤 Share
          </button>
        ) : (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="btn py-3 text-sm text-night-950"
            style={{ backgroundImage: 'linear-gradient(135deg,#25d366,#128c7e)', boxShadow: '0 8px 24px -8px rgba(37,211,102,0.6)' }}
          >
            💬 WhatsApp
          </a>
        )}
        <button onClick={() => setShowQr((v) => !v)} className="btn-ghost py-3 text-sm">
          {showQr ? '✕ QR' : '▦ QR'}
        </button>
      </div>

      {showQr && (
        <div className="mt-3 flex animate-popIn flex-col items-center gap-2">
          <div className="rounded-2xl bg-sand p-3 shadow-glow-teal">
            <QRCodeCanvas value={joinUrl} size={176} includeMargin={false} bgColor="#F4E8D8" fgColor="#120D0B" />
          </div>
          <div className="text-xs text-sand/45">Scan to jump straight into the room</div>
        </div>
      )}
    </div>
  );
}
