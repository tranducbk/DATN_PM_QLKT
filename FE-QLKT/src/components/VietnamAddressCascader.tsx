'use client';

import { useState, useEffect } from 'react';
import { Cascader } from 'antd';
import type { CascaderProps } from 'antd';

interface Ward {
  Id: string;
  Name: string;
  Level: string;
}

interface District {
  Id: string;
  Name: string;
  Wards: Ward[];
}

interface Province {
  Id: string;
  Name: string;
  Districts: District[];
}

interface Option {
  value: string;
  label: string;
  children?: Option[];
}

interface VietnamAddressCascaderProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  size?: 'small' | 'middle' | 'large';
  className?: string;
  disabled?: boolean;
}

export default function VietnamAddressCascader({
  value,
  onChange,
  placeholder = 'Chọn Tỉnh/Thành phố, Quận/Huyện, Xã/Phường',
  size = 'large',
  className = '',
  disabled = false,
}: VietnamAddressCascaderProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddressData();
  }, []);

  const loadAddressData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/vietnamAddress.json');
      const data: Province[] = await response.json();

      // Transform data to Cascader format
      const cascaderOptions: Option[] = data.map((province) => ({
        value: province.Name,
        label: province.Name,
        children: province.Districts.map((district) => ({
          value: district.Name,
          label: district.Name,
          children: district.Wards.map((ward) => ({
            value: ward.Name,
            label: ward.Name,
          })),
        })),
      }));

      setOptions(cascaderOptions);
    } catch (error) {
      console.error('Error loading address data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange: CascaderProps<Option>['onChange'] = (selectedValues) => {
    if (onChange) {
      onChange(selectedValues as string[]);
    }
  };

  const displayRender = (labels: string[]) => {
    return labels.join(' / ');
  };

  return (
    <div className="vietnam-address-cascader-wrapper" style={{ width: '100%' }}>
      <Cascader
        options={options}
        onChange={handleChange}
        value={value}
        placeholder={placeholder}
        size={size}
        className={className}
        disabled={disabled}
        loading={loading}
        showSearch={{
          filter: (inputValue, path) =>
            path.some(
              (option) =>
                option.label && option.label.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
            ),
        }}
        displayRender={displayRender}
        allowClear
        style={{ width: '100%' }}
      />
    </div>
  );
}
