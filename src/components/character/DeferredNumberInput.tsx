import React, { useState, useEffect } from 'react';

export function DeferredNumberInput({ 
  value, 
  onChange, 
  className, 
  min, 
  max,
  id
}: { 
  value: number, 
  onChange: (v: number) => void, 
  className?: string, 
  min?: number, 
  max?: number,
  id?: string
}) {
  const [temp, setTemp] = useState(value);

  useEffect(() => {
    setTemp(value);
  }, [value]);

  const handleBlur = () => {
    let final = temp;
    if (min !== undefined) final = Math.max(min, final);
    if (max !== undefined) final = Math.min(max, final);
    if (final !== value) {
      onChange(final);
    } else {
      setTemp(value);
    }
  };

  return (
    <input 
      id={id}
      type="number"
      value={temp}
      onChange={(e) => setTemp(parseInt(e.target.value) || 0)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
    />
  );
}
