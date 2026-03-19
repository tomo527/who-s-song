import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className = '', ...props }) => {
  return (
    <div className="w-full space-y-2">
      {label && <label className="block text-sm font-semibold text-slate-100/92">{label}</label>}
      <input
        className={`
          w-full rounded-[1.25rem] border border-white/12 bg-white/8 px-4 py-3.5 text-slate-50
          placeholder:text-slate-400 outline-none transition
          focus:border-primary-300/70 focus:bg-white/12 focus:ring-4 focus:ring-primary-300/10
          ${error ? 'border-red-300/60 bg-red-500/10 focus:border-red-300 focus:ring-red-300/10' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs font-semibold text-red-200">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
};
