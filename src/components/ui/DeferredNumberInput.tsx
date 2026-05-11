import { useState, useEffect } from 'react';

export interface DeferredNumberInputProps {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  id?: string;
}

export function DeferredNumberInput({ 
  value, 
  onChange, 
  className,
  min,
  max,
  placeholder,
  id
}: DeferredNumberInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    let num = parseInt(localValue);
    if (isNaN(num)) {
      setLocalValue(value.toString());
      return;
    }
    
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    
    setLocalValue(num.toString());
    onChange(num);
  };

  return (
    <input 
      id={id}
      type="text"
      inputMode="numeric"
      value={localValue}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.target.value.replace(/\D/g, ''))}
      onBlur={handleBlur}
      className={className}
    />
  );
}
