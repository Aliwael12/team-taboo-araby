import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Room invite panel: join code + copy link + WhatsApp + QR.
// The link/QR carry the code, so they act as the "key" to the room — no typing.
export default function Share({ code }) {
  const [copied, setCopied] = useState('');
  const [showQr, setShowQr] = useState(false);
  const joinUrl = `${location.origin}/?room=${code}`;
  const waText = encodeURIComponent(`Join my Team Taboo game! Tap to enter (code ${code}): ${joinUrl}`);
  const waUrl = `https://wa.me/?text=${waText}`;

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

  return (
    <div className="glass p-4">
      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">Room code</div>
        <button
          onClick={() => copy(code, 'code')}
          className="mt-1 bg-violet-cyan bg-clip-text font-display text-5xl font-black tracking-[0.15em] text-transparent transition active:scale-95"
          title="Tap to copy"
          style={{ WebkitTextFillColor: 'transparent' }}
        >
          {code}
        </button>
        <div className="h-4 text-xs text-neon-green">{copied === 'code' ? 'Code copied!' : ''}</div>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-2">
        <button onClick={() => copy(joinUrl, 'link')} className="btn-ghost py-3 text-sm">
          {copied === 'link' ? '✓ Copied' : '🔗 Link'}
        </button>
        <a href={waUrl} target="_blank" rel="noreferrer" className="btn py-3 text-sm text-ink-950"
           style={{ backgroundImage: 'linear-gradient(135deg,#25d366,#128c7e)', boxShadow: '0 8px 24px -8px rgba(37,211,102,0.6)' }}>
          💬 WhatsApp
        </a>
        <button onClick={() => setShowQr((v) => !v)} className="btn-ghost py-3 text-sm">
          {showQr ? '✕ QR' : '▦ QR'}
        </button>
      </div>

      {showQr && (
        <div className="mt-3 flex animate-popIn flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-glow-cyan">
            <QRCodeCanvas value={joinUrl} size={176} includeMargin={false} bgColor="#ffffff" fgColor="#0b0b14" />
          </div>
          <div className="text-xs text-white/45">Scan to jump straight into the room</div>
        </div>
      )}
    </div>
  );
}
