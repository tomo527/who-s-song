import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, selected }) => {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-[1.75rem] border p-5 backdrop-blur-xl transition-all duration-200
        bg-white/9 border-white/10 shadow-[0_20px_60px_-30px_rgba(8,18,34,0.95)]
        ${onClick ? 'cursor-pointer active:scale-[0.985]' : ''}
        ${selected ? 'border-primary-300/60 bg-primary-400/16 ring-1 ring-primary-200/40' : 'hover:border-white/16 hover:bg-white/12'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
