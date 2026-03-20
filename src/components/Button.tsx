import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  fullWidth,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-[1.35rem] border font-semibold tracking-tight transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55';

  const variants = {
    primary:
      'border-primary-500 bg-primary-500 text-white focus-visible:ring-primary-300 focus-visible:ring-offset-white hover:bg-primary-600 active:bg-primary-700',
    secondary:
      'border-accent-500 bg-accent-500 text-white focus-visible:ring-accent-300 focus-visible:ring-offset-white hover:bg-accent-700 active:bg-accent-700',
    outline:
      'border-slate-300 bg-white text-slate-700 focus-visible:ring-slate-200 focus-visible:ring-offset-white hover:bg-slate-50 hover:border-slate-400',
    ghost:
      'border-transparent bg-transparent text-slate-600 focus-visible:ring-slate-200 focus-visible:ring-offset-white hover:bg-slate-100 hover:text-slate-900',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-5 py-3 text-[15px]',
    lg: 'px-6 py-3.5 text-base',
    xl: 'px-6 py-4 text-lg w-full',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="h-4.5 w-4.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
        </svg>
      )}
      {children}
    </button>
  );
};
