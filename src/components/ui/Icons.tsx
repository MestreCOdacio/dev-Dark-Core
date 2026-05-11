import React from 'react';

export const D20Icon = ({ size = 18 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 2l10 5-10 5-10-5 10-5z" />
    <path d="M2 7l10 5 10-5" />
    <path d="M12 22l10-5-10-5-10 5 10 5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 7v10" />
    <path d="M22 7v10" />
    <path d="M12 2v20" />
  </svg>
);

export const EditIcon = ({ size = 12, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
