"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PAY, STATUS } from "./api";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ title, sub, icon, actions, children, className, flush }: { title?: ReactNode; sub?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx("admin-shadow overflow-hidden rounded-2xl border border-line bg-panel", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold-ink">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
              {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

/** Cabecera de página a todo lo ancho, con la franja de marca abajo. */
export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="-mx-4 mb-6 bg-panel lg:-mx-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 lg:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight lg:text-[28px]">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="brand-stripe h-[3px]" />
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "danger" | "ok" | "dark"; size?: "sm" | "md" };
export function Btn({ variant = "ghost", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "gold" && "bg-gold text-char shadow-[0_6px_16px_-8px_rgb(242_171_0/0.9)] hover:bg-gold-2",
        variant === "dark" && "bg-char text-white hover:bg-char-2",
        variant === "ghost" && "border border-line bg-panel text-ink hover:border-ink/25 hover:bg-panel-2",
        variant === "danger" && "bg-red text-white hover:bg-red-2",
        variant === "ok" && "bg-emerald-600 text-white hover:bg-emerald-500",
        className,
      )}
    />
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; hideLabel?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("inline-flex items-center gap-2 text-sm disabled:opacity-50")}
    >
      <span className={cx("relative h-[22px] w-10 rounded-full transition", checked ? "bg-emerald-500" : "bg-[#d9d1c5]")}>
        <span className={cx("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
      </span>
      {label && !hideLabel && <span>{label}</span>}
    </button>
  );
}

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap";
export function StatusBadge({ s }: { s: string }) {
  const v = STATUS[s] ?? { label: s, cls: "" };
  return <span className={cx(pill, v.cls)}>{v.label}</span>;
}
export function PayBadge({ s }: { s: string }) {
  const v = PAY[s] ?? { label: s, cls: "" };
  return <span className={cx(pill, v.cls)}>{v.label}</span>;
}

/** Paginación numerada: « Anterior 1 2 … 16 Siguiente » */
export function Pager({ page, total, size, onPage, noun = "resultados" }: { page: number; total: number; size: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const cell = "grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-sm font-semibold transition";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-muted">
      <span>
        Página {page} de {pages} · {total} {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <button className={cx(cell, "border-line bg-panel px-3 text-ink hover:bg-panel-2 disabled:opacity-40")} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Anterior
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
            <button aria-current={n === page ? "page" : undefined} className={cx(cell, n === page ? "border-char bg-char text-white" : "border-line bg-panel text-ink hover:bg-panel-2")} onClick={() => onPage(n)}>
              {n}
            </button>
          </span>
        ))}
        <button className={cx(cell, "border-line bg-panel px-3 text-ink hover:bg-panel-2 disabled:opacity-40")} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="admin-ui fixed inset-0 z-50 flex justify-end bg-transparent" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" className="absolute inset-0 bg-char/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("relative flex h-full w-full flex-col bg-panel shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink">
            <X className="size-5" />
          </button>
        </header>
        <div className="brand-stripe h-[3px]" />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
      {icon && <span className="text-muted/60">{icon}</span>}
      {children}
    </div>
  );
}

export function Table({ head, children, flush }: { head: ReactNode[]; children: ReactNode; flush?: boolean }) {
  return (
    <div className={cx("overflow-x-auto", !flush && "-mx-5")}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#fbf6ea] text-[13px] text-ink/70">
          <tr className="border-y border-line">
            {head.map((h, i) => (
              <th key={i} className="px-5 py-3 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-5 [&_td]:py-3.5">{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- avisos ---------- */
type Note = { id: number; msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Note[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((n) => n.id !== id)), kind === "err" ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {list.map((n) => (
          <div key={n.id} className={cx("max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl", n.kind === "ok" ? "bg-char text-white" : "bg-red text-white")}>
            {n.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Carga datos con estado de carga/error y función para recargar. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recarga cuando cambian los parámetros
  }, [key]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}
