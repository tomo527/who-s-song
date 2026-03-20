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
        rounded-[1.75rem] border-2 p-5 transition-all duration-200
        bg-white border-slate-600/40 shadow-none
        ${onClick ? 'cursor-pointer active:scale-[0.985]' : ''}
        ${selected ? 'border-primary-400 bg-primary-50 ring-0' : 'hover:border-slate-600/50 hover:bg-slate-50'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
