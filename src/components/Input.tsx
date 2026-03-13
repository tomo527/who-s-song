import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className = '', ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-bold text-slate-700 ml-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl
          focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-50
          transition-all placeholder:text-slate-300
          ${error ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs font-bold text-red-500 ml-1">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-400 ml-1">{helperText}</p>}
    </div>
  );
};
