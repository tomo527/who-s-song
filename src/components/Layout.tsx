import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onBack }) => {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900 selection:bg-primary-300/30">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/92">
        <div className="mx-auto flex h-18 max-w-md items-center gap-3 px-4">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="戻る"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <div className="min-w-0 flex items-end gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
              {title || '誰の曲？'}
            </h1>
            {!title && (
              <span className="truncate pb-0.5 text-[11px] font-medium tracking-[0.18em] text-slate-400">
                Anonymous Setlist Game
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 py-5 pb-28">{children}</main>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/92 px-4 py-4 text-center text-[11px] text-slate-500">
        誰の曲？匿名セトリ推理ゲーム
      </footer>
    </div>
  );
};
