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
        bg-white rounded-3xl p-5 border-2 transition-all duration-200
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${selected 
          ? 'border-primary-400 bg-primary-50 ring-4 ring-primary-100' 
          : 'border-white shadow-sm hover:shadow-md hover:border-slate-100'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
