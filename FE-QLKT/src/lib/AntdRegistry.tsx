'use client';

import React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { ANTD_FONT_FAMILY } from '@/lib/antdTheme';

export default function AntdRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = React.useState(() => createCache());

  useServerInsertedHTML(() => {
    return <style id="antd" dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }} />;
  });

  return (
    <StyleProvider cache={cache}>
      <ConfigProvider theme={{ token: { fontFamily: ANTD_FONT_FAMILY } }}>
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
