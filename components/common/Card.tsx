
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-court-bg-light rounded-lg shadow-lg p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
