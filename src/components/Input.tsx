import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  tone?: 'dark' | 'light';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  tone = 'dark',
  className = '',
  ...props
}) => {
  const labelClassName = tone === 'light' ? 'text-slate-800' : 'text-slate-100/92';
  const inputToneClassName =
    tone === 'light'
      ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-accent-400 focus:bg-white focus:ring-accent-100'
      : 'border-white/12 bg-white/8 text-slate-50 placeholder:text-slate-400 focus:border-primary-300/70 focus:bg-white/12 focus:ring-primary-300/10';
  const helperClassName = tone === 'light' ? 'text-slate-500' : 'text-slate-400';
  const errorClassName = tone === 'light' ? 'text-red-600' : 'text-red-200';

  return (
    <div className="w-full space-y-2">
      {label && <label className={`block text-sm font-semibold ${labelClassName}`}>{label}</label>}
      <input
        className={`
          w-full rounded-[1.25rem] border px-4 py-3.5 outline-none transition
          focus:ring-4
          ${inputToneClassName}
          ${error ? 'border-red-300/60 bg-red-500/10 focus:border-red-300 focus:ring-red-300/10' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className={`text-xs font-semibold ${errorClassName}`}>{error}</p>}
      {!error && helperText && <p className={`text-xs ${helperClassName}`}>{helperText}</p>}
    </div>
  );
};
