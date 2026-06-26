'use client';

import { CSSProperties, ReactNode } from 'react';
import { Alert } from 'antd';
import {
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

type InfoNoteType = 'info' | 'warning' | 'success' | 'error';

const TYPE_ICON: Record<InfoNoteType, ReactNode> = {
  info: <InfoCircleOutlined />,
  warning: <WarningOutlined />,
  success: <CheckCircleOutlined />,
  error: <CloseCircleOutlined />,
};

const TYPE_COLOR: Record<InfoNoteType, string> = {
  info: '#1677ff',
  warning: '#faad14',
  success: '#52c41a',
  error: '#ff4d4f',
};

interface InfoNoteProps {
  title?: ReactNode;
  description?: ReactNode;
  items?: ReactNode[];
  ordered?: boolean;
  type?: InfoNoteType;
  icon?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Page-level guidance/help banner with a consistent look across the app.
 * The leading icon sits on the same line as the heading (or the first line of a title-less note),
 * so the body never indents awkwardly under a separate icon column.
 * @param title - Bold heading; omit for a single-line note
 * @param description - Intro paragraph shown above the list
 * @param items - List lines; bullet list, or numbered when `ordered`
 * @param ordered - Render `items` as a numbered list
 * @param type - Banner colour/semantics: info, warning, success or error
 * @param icon - Optional icon overriding the per-type default
 * @param children - Extra body content rendered after the list, e.g. an action button
 * @param style - Extra styles merged onto the banner
 * @returns The guidance banner element
 */
export function InfoNote({
  title,
  description,
  items,
  ordered = false,
  type = 'info',
  icon,
  children,
  style,
}: InfoNoteProps) {
  const ListTag = ordered ? 'ol' : 'ul';
  const hasList = items != null && items.length > 0;
  const resolvedIcon = icon ?? TYPE_ICON[type];

  const body = (
    <>
      {description != null && (
        <div style={{ marginTop: title != null ? 4 : 0, lineHeight: 1.7 }}>{description}</div>
      )}
      {hasList && (
        <ListTag
          style={{
            margin: title != null || description != null ? '4px 0 0' : 0,
            paddingLeft: 20,
            lineHeight: 1.9,
          }}
        >
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ListTag>
      )}
      {children != null && <div style={{ marginTop: 10 }}>{children}</div>}
    </>
  );

  const iconEl = <span style={{ color: TYPE_COLOR[type], display: 'inline-flex' }}>{resolvedIcon}</span>;

  const message =
    title != null ? (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          {iconEl}
          <span>{title}</span>
        </div>
        {body}
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ marginTop: 3 }}>{iconEl}</span>
        <div style={{ lineHeight: 1.7 }}>{body}</div>
      </div>
    );

  return (
    <Alert type={type} showIcon={false} message={message} style={{ marginBottom: 16, ...style }} />
  );
}
