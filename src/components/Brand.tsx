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
