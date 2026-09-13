"use client";

export function BotaoImprimir({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="btn btn-outline no-print" onClick={() => window.print()}>
      {children}
    </button>
  );
}
