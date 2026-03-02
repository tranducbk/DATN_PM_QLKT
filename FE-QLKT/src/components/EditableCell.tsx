'use client';

import { useState, useEffect } from 'react';
import { Input, Checkbox, Select } from 'antd';
import { useTheme } from '@/components/theme-provider';

interface EditableCellProps {
  value: any;
  type: 'text' | 'checkbox' | 'number' | 'select';
  onSave: (newValue: any) => void;
  editable?: boolean;
  options?: { label: string; value: string }[];
}

export function EditableCell({
  value,
  type,
  onSave,
  editable = true,
  options = [],
}: EditableCellProps) {
  const { theme: currentTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  // Sync currentValue với value prop khi value thay đổi
  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (currentValue !== value) {
      onSave(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (!editable) {
    if (type === 'checkbox') {
      return <Checkbox checked={!!value} disabled />;
    }
    if (type === 'select') {
      const option = options.find(opt => opt.value === value);
      return (
        <span
          style={{
            color: currentTheme === 'dark' ? '#9ca3af' : '#666',
          }}
        >
          {option?.label || value || '-'}
        </span>
      );
    }
    return (
      <span
        style={{
          color: currentTheme === 'dark' ? '#9ca3af' : '#666',
        }}
      >
        {value || '-'}
      </span>
    );
  }

  if (type === 'checkbox') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Checkbox
          checked={!!currentValue}
          onChange={e => {
            setCurrentValue(e.target.checked);
            onSave(e.target.checked);
          }}
        />
      </div>
    );
  }

  if (type === 'select') {
    return (
      <Select
        value={currentValue}
        onChange={val => {
          setCurrentValue(val);
          onSave(val);
        }}
        style={{ width: '100%' }}
        size="small"
        options={options}
      />
    );
  }

  if (isEditing) {
    return (
      <Input
        type={type === 'number' ? 'number' : 'text'}
        value={currentValue || ''}
        onChange={e => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          minWidth: type === 'number' ? '100px' : '150px',
          width: '100%',
        }}
      />
    );
  }

  const hoverBgColor = currentTheme === 'dark' ? '#374151' : '#f5f5f5';
  const placeholderColor = currentTheme === 'dark' ? '#6b7280' : '#bfbfbf';

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        cursor: 'pointer',
        padding: '4px 8px',
        minHeight: '32px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '4px',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBgColor)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {currentValue || (
        <span style={{ color: placeholderColor, fontStyle: 'italic' }}>Nhấn để sửa</span>
      )}
    </div>
  );
}
