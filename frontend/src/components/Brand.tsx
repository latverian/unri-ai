import { usePrefs } from "../lib/prefs";

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  // Ikon selembayung: dua garis bersilang di puncak atap rumah Melayu, titik emas = cahaya ilmu.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path d="M14 50 L36 16 M50 50 L28 16" strokeWidth="4.5" strokeLinecap="round" fill="none" className="stroke-onprimary" />
      <path d="M22 50 h20" strokeWidth="4" strokeLinecap="round" className="stroke-onprimary" />
      <circle cx="32" cy="22.5" r="4.2" fill="#E3BE4F" />
    </svg>
  );
}

export function Wordmark({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="font-serif text-xl font-semibold text-primary-strong">
        Balai <span className="text-emas-teks">Ilmu</span>
      </span>
      {subtitle && <span className="truncate text-xs font-medium text-teks-2">Studi kasus UNRI</span>}
    </span>
  );
}

/** Garis pucuk rebung (motif songket) sebagai pembatas. */
export function PucukRebung({ className = "", force = false }: { className?: string; force?: boolean }) {
  const { prefs } = usePrefs();
  if (!prefs.ornamen && !force) return <div className="h-px w-full bg-garis" aria-hidden="true" />;
  return (
    <svg className={`block w-full ${className}`} height="8" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id="pucuk-rebung" width="16" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 L8 0 L16 8" fill="none" stroke="rgb(var(--emas))" strokeWidth="1.25" />
          <path d="M4 8 L8 4 L12 8" fill="rgb(var(--emas))" opacity=".55" />
        </pattern>
      </defs>
      <rect width="100%" height="8" fill="url(#pucuk-rebung)" />
    </svg>
  );
}

export function Pantun({ lines, className = "" }: { lines: string[]; className?: string }) {
  const { prefs } = usePrefs();
  if (!prefs.pantun) return null;
  return (
    <blockquote className={`font-serif italic leading-relaxed text-teks-2 ${className}`}>
      {lines.map((l) => <span key={l} className="block">{l}</span>)}
    </blockquote>
  );
}
