/** Icono propio de hamburguesa (pan, carne y queso) para el logo. */
export function BurgerMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <path
        d="M6 22c0-11 11.6-18 26-18s26 7 26 18z"
        fill="#ffc21a"
        stroke="#e3261b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g fill="#e3261b">
        <circle cx="22" cy="12" r="1.6" />
        <circle cx="32" cy="9" r="1.6" />
        <circle cx="42" cy="12" r="1.6" />
        <circle cx="27" cy="16" r="1.6" />
        <circle cx="37" cy="16" r="1.6" />
      </g>
      <path
        d="M4 27h56l-6 6-6-4-6 4-6-4-6 4-6-4-6 4-6-4z"
        fill="#ffc21a"
        stroke="#e3261b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="5" y="32" width="54" height="6" rx="3" fill="#e3261b" />
      <path
        d="M7 40h50c0 4-3 6-7 6H14c-4 0-7-2-7-6z"
        fill="#ffc21a"
        stroke="#e3261b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="#"
      className="flex items-center gap-2"
      aria-label="Crea tu Burger, inicio"
    >
      <BurgerMark className={compact ? "h-9 w-12" : "h-11 w-14"} />
      <span className="relative font-display font-black italic uppercase leading-[0.85]">
        <span
          className={`block ${compact ? "text-[13px]" : "text-[15px]"} text-ink`}
        >
          Crea tu
        </span>
        <span
          className={`block ${compact ? "text-[24px]" : "text-[30px]"} text-gold`}
        >
          Burger
        </span>
        <svg
          viewBox="0 0 100 8"
          className="absolute -bottom-2 left-0 h-2 w-full"
          aria-hidden
          preserveAspectRatio="none"
        >
          <path
            d="M2 6C30 1 70 0 98 3"
            stroke="#e3261b"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </a>
  );
}

/** Letrero de neón decorativo en la pared del escenario. */
export function NeonBurger({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 130"
      className={`neon ${className}`}
      aria-hidden
      fill="none"
      stroke="#ffb347"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
        <rect
          x="12"
          y="6"
          width="4.5"
          height="24"
          rx="1.2"
          fill="#ffcf4a"
          transform="rotate(-10 14 18)"
        />
        <rect
          x="18"
          y="3"
          width="4.5"
          height="26"
          rx="1.2"
          fill="#ffd862"
          transform="rotate(-3 20 16)"
        />
        <rect
          x="24"
          y="4"
          width="4.5"
          height="26"
          rx="1.2"
          fill="#ffc93a"
          transform="rotate(4 26 17)"
        />
        <rect
          x="30"
          y="7"
          width="4.5"
          height="23"
          rx="1.2"
          fill="#ffd456"
          transform="rotate(11 32 18)"
        />
        <rect x="21" y="8" width="4.5" height="22" rx="1.2" fill="#ffe07a" />
      </g>
      <path d="M9 22h30l-4 22H13z" fill="#e3261b" />
      <path d="M9 22h30l-.7 4H9.7z" fill="#b5150d" />
      <path
        d="M18 33c2 3 10 3 12 0"
        stroke="#ffc21a"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Lata genérica de refresco, sin logos: color de la bebida y franja negra si es zero. */
export function CanArt({
  color,
  zero = false,
  className = "",
}: {
  color: string;
  zero?: boolean;
  className?: string;
}) {
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
      <rect
        x="14"
        y="7"
        width="20"
        height="36"
        rx="4"
        fill={zero ? "#141414" : color}
      />
      {zero && <rect x="14" y="20" width="20" height="9" fill={color} />}
      <path
        d="M17 13c4 3 10-2 14 1"
        stroke="#fff"
        strokeOpacity="0.85"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <rect
        x="14"
        y="7"
        width="20"
        height="36"
        rx="4"
        fill={`url(#can-${color}-${zero})`}
      />
      <rect x="15.5" y="4.5" width="17" height="4" rx="1.5" fill="#cfd3d6" />
      <rect x="15.5" y="41" width="17" height="3" rx="1.5" fill="#b9bdc0" />
    </svg>
  );
}

/** Bote de salsa tipo squeeze (ilustración propia, sin marcas). */
export function SauceBottle({
  color,
  cap,
  className = "",
}: {
  color: string;
  cap: string;
  className?: string;
}) {
  const id = `sb-${color.slice(1)}`;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <path d="M22.5 2h3l1 5h-5z" fill={cap} />
      <path d="M18 7h12l1.5 4h-15z" fill={cap} />
      <path
        d="M16 12c0-1 1-1.5 2-1.5h12c1 0 2 .5 2 1.5l1.5 4c.6 1.6 1 3.4 1 5.2V42c0 2.2-1.8 4-4 4H17.5c-2.2 0-4-1.8-4-4V21.2c0-1.8.4-3.6 1-5.2z"
        fill={color}
      />
      <rect
        x="15.5"
        y="24"
        width="17"
        height="11"
        rx="2"
        fill="#fff"
        fillOpacity="0.9"
      />
      <rect x="18" y="27.5" width="12" height="1.6" rx=".8" fill={color} />
      <rect
        x="19.5"
        y="30.5"
        width="9"
        height="1.4"
        rx=".7"
        fill={color}
        fillOpacity="0.6"
      />
      <path
        d="M16 12c0-1 1-1.5 2-1.5h12c1 0 2 .5 2 1.5l1.5 4c.6 1.6 1 3.4 1 5.2V42c0 2.2-1.8 4-4 4H17.5c-2.2 0-4-1.8-4-4V21.2c0-1.8.4-3.6 1-5.2z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

/** Icono "elige tus ingredientes": capas de hamburguesa separadas con un "+" para añadir. */
export function IngredientsIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5C3 6 6.2 3.5 10.5 3.5S18 6 18 9.5z" />
      <path d="M2.5 13c1.4 1 2.8 1 4.2 0 1.4 1 2.8 1 4.2 0 1.4 1 2.8 1 4.2 0 1.2.9 2.3 1 3.4.4" />
      <rect x="3" y="15.5" width="15" height="2.6" rx="1.3" />
      <path d="M3.5 20.5h14" />
      <circle
        cx="19"
        cy="5"
        r="3.6"
        fill="currentColor"
        stroke="none"
        opacity="0.18"
      />
      <path d="M19 3.3v3.4M17.3 5h3.4" strokeWidth="1.9" />
    </svg>
  );
}

/** Hamburguesa que se arma capa a capa mientras cargan los modelos 3D. */
export function BurgerLoader({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={`burger-loader ${className}`}
      aria-hidden
    >
      <g className="bl-layer" style={{ animationDelay: "0.75s" }}>
        <path d="M14 46c0-20 20-34 46-34s46 14 46 34z" fill="#c7772d" />
        <path
          d="M18 44c2-16 20-28 42-28s40 12 42 28"
          fill="none"
          stroke="#e39a4b"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".7"
        />
        <g fill="#fbe9c8">
          <ellipse
            cx="44"
            cy="24"
            rx="2.6"
            ry="1.4"
            transform="rotate(-20 44 24)"
          />
          <ellipse cx="60" cy="19" rx="2.6" ry="1.4" />
          <ellipse
            cx="76"
            cy="24"
            rx="2.6"
            ry="1.4"
            transform="rotate(20 76 24)"
          />
          <ellipse
            cx="52"
            cy="32"
            rx="2.6"
            ry="1.4"
            transform="rotate(-10 52 32)"
          />
          <ellipse
            cx="68"
            cy="32"
            rx="2.6"
            ry="1.4"
            transform="rotate(10 68 32)"
          />
        </g>
      </g>
      <g className="bl-layer" style={{ animationDelay: "0.6s" }}>
        <path
          d="M12 50h96l-8 8-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5z"
          fill="#ffc21a"
        />
      </g>
      <g className="bl-layer" style={{ animationDelay: "0.45s" }}>
        <rect x="12" y="56" width="96" height="11" rx="5.5" fill="#5a2f1b" />
      </g>
      <g className="bl-layer" style={{ animationDelay: "0.3s" }}>
        <rect x="16" y="66" width="88" height="5" rx="2.5" fill="#d53a2a" />
      </g>
      <g className="bl-layer" style={{ animationDelay: "0.15s" }}>
        <path
          d="M10 73c6-4 10 4 16 0s10 4 16 0 10 4 16 0 10 4 16 0 10 4 16 0 10 4 18 0v4H10z"
          fill="#79bd42"
        />
      </g>
      <g className="bl-layer" style={{ animationDelay: "0s" }}>
        <path d="M14 78h92c0 9-7 15-16 15H30c-9 0-16-6-16-15z" fill="#c7772d" />
      </g>
    </svg>
  );
}
