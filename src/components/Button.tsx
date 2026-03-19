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
    'inline-flex items-center justify-center gap-2 rounded-[1.35rem] font-semibold tracking-tight transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

  const variants = {
    primary:
      'bg-linear-to-r from-primary-500 to-accent-500 text-white shadow-[0_18px_40px_-18px_rgba(59,130,246,0.8)] hover:brightness-110',
    secondary:
      'bg-white/10 text-white border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-white/14',
    outline:
      'bg-transparent border border-white/14 text-slate-200 hover:bg-white/8 hover:border-white/24',
    ghost:
      'bg-transparent text-slate-300 hover:bg-white/8 hover:text-white',
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
