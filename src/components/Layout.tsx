import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <button 
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="戻る"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              {title || "誰の曲？"}
            </h1>
          </div>
        </div>
      </header>
      
      <main className="max-w-md mx-auto px-4 py-6 pb-24">
        {children}
      </main>
      
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-xs text-slate-400 bg-gradient-to-t from-slate-50 to-transparent">
        © 2024 誰の曲？匿名セトリ推理ゲーム
      </footer>
    </div>
  );
};
