/** Icono propio de hamburguesa (pan, carne y queso) para el logo. */
export function BurgerMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path d="M6 22c0-11 11.6-18 26-18s26 7 26 18z" fill="#ffc21a" stroke="#e3261b" strokeWidth="3" strokeLinejoin="round" />
      <g fill="#e3261b">
        <circle cx="22" cy="12" r="1.6" />
        <circle cx="32" cy="9" r="1.6" />
        <circle cx="42" cy="12" r="1.6" />
        <circle cx="27" cy="16" r="1.6" />
        <circle cx="37" cy="16" r="1.6" />
      </g>
      <path d="M4 27h56l-6 6-6-4-6 4-6-4-6 4-6-4-6 4-6-4z" fill="#ffc21a" stroke="#e3261b" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="5" y="32" width="54" height="6" rx="3" fill="#e3261b" />
      <path d="M7 40h50c0 4-3 6-7 6H14c-4 0-7-2-7-6z" fill="#ffc21a" stroke="#e3261b" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#" className="flex items-center gap-2" aria-label="Crea tu Burger, inicio">
      <BurgerMark className={compact ? "h-9 w-12" : "h-11 w-14"} />
      <span className="relative font-display font-black italic uppercase leading-[0.85]">
        <span className={`block ${compact ? "text-[13px]" : "text-[15px]"} text-ink`}>Crea tu</span>
        <span className={`block ${compact ? "text-[24px]" : "text-[30px]"} text-gold`}>Burger</span>
        <svg viewBox="0 0 100 8" className="absolute -bottom-2 left-0 h-2 w-full" aria-hidden preserveAspectRatio="none">
          <path d="M2 6C30 1 70 0 98 3" stroke="#e3261b" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </a>
  );
}

/** Letrero de neón decorativo en la pared del escenario. */
export function NeonBurger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 130" className={`neon ${className}`} aria-hidden fill="none" stroke="#ffb347" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 52C18 26 46 10 80 10s62 16 62 42z" />
      <path d="M14 70h132" />
      <path d="M16 84c10 8 20 8 32 0 12 8 22 8 32 0 12 8 22 8 32 0 10 8 20 8 32 0" />
      <path d="M22 100h116c0 12-8 20-20 20H42c-12 0-20-8-20-20z" />
    </svg>
  );
}

/** Papas fritas en su cajita (ilustración propia). */
export function FriesArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <g stroke="#b86a08" strokeWidth="0.8">
        <rect x="12" y="6" width="4.5" height="24" rx="1.2" fill="#ffcf4a" transform="rotate(-10 14 18)" />
        <rect x="18" y="3" width="4.5" height="26" rx="1.2" fill="#ffd862" transform="rotate(-3 20 16)" />
        <rect x="24" y="4" width="4.5" height="26" rx="1.2" fill="#ffc93a" transform="rotate(4 26 17)" />
        <rect x="30" y="7" width="4.5" height="23" rx="1.2" fill="#ffd456" transform="rotate(11 32 18)" />
        <rect x="21" y="8" width="4.5" height="22" rx="1.2" fill="#ffe07a" />
      </g>
      <path d="M9 22h30l-4 22H13z" fill="#e3261b" />
      <path d="M9 22h30l-.7 4H9.7z" fill="#b5150d" />
      <path d="M18 33c2 3 10 3 12 0" stroke="#ffc21a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Lata genérica de refresco, sin logos: color de la bebida y franja negra si es zero. */
export function CanArt({ color, zero = false, className = "" }: { color: string; zero?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`can-${color}-${zero}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="14" y="7" width="20" height="36" rx="4" fill={zero ? "#141414" : color} />
      {zero && <rect x="14" y="20" width="20" height="9" fill={color} />}
      <path d="M17 13c4 3 10-2 14 1" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="14" y="7" width="20" height="36" rx="4" fill={`url(#can-${color}-${zero})`} />
      <rect x="15.5" y="4.5" width="17" height="4" rx="1.5" fill="#cfd3d6" />
      <rect x="15.5" y="41" width="17" height="3" rx="1.5" fill="#b9bdc0" />
    </svg>
  );
}
