// A player token. Tapping the body runs the main action (assign/select);
// the host also gets a small ✕ to kick that player out of the room.
export default function PlayerPill({ label, you, selected, ring, boxShadow, disabled, canKick, onMain, onKick, mainTitle }) {
  const base = selected
    ? 'bg-amber text-night-950 shadow-glow-amber'
    : you
      ? 'bg-sand text-night-950'
      : 'bg-night-800 text-sand';
  return (
    <span
      className={`inline-flex animate-popIn items-center rounded-full text-sm font-medium ${base} ${ring ? 'ring-1 ring-sand/40' : ''}`}
      style={boxShadow ? { boxShadow } : undefined}
    >
      <button
        disabled={disabled}
        onClick={onMain}
        title={mainTitle || ''}
        className={`py-1.5 pl-3 ${canKick ? 'pr-1.5' : 'pr-3'} ${disabled ? '' : 'active:scale-95'}`}
      >
        {label}
        {you ? ' (you)' : ''}
      </button>
      {canKick && (
        <button
          onClick={onKick}
          title="Kick from room"
          className="mr-1 grid h-5 w-5 place-items-center rounded-full opacity-50 transition hover:bg-chili/40 hover:text-sand hover:opacity-100 active:scale-90"
        >
          ✕
        </button>
      )}
    </span>
  );
}
