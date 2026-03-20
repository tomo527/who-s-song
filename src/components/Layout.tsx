import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onBack }) => {
  return (
    <div className="min-h-screen text-slate-50 selection:bg-primary-300/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/88">
        <div className="mx-auto flex h-18 max-w-md items-center gap-3 px-4">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-200 transition hover:bg-white/10"
              aria-label="戻る"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-white">
              {title || '誰の曲？'}
            </h1>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md px-4 py-5 pb-28">{children}</main>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 border-t border-white/6 bg-ink-950/92 px-4 py-4 text-center text-[11px] text-slate-500">
        3-8人で遊べる匿名セトリ推理ゲーム
      </footer>
    </div>
  );
};
