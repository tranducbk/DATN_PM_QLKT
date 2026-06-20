'use client';

import { ReactNode } from 'react';
import { Alert } from 'antd';

interface StepGuideProps {
  title: ReactNode;
  steps: ReactNode[];
  icon?: ReactNode;
}

/**
 * Instruction banner shown at the top of each wizard step.
 * Auto-numbers the steps so adding or removing a line never requires manual renumbering.
 * @param title - Step heading (e.g. "Bước 2: Lựa chọn quân nhân - ...")
 * @param steps - Ordered guidance lines; plain strings or rich nodes
 * @param icon - Optional leading icon overriding the default info icon
 * @returns The guide banner element
 */
export function StepGuide({ title, steps, icon }: StepGuideProps) {
  return (
    <Alert
      message={title}
      description={
        <div>
          {steps.map((step, index) => (
            <p key={index}>
              {index + 1}. {step}
            </p>
          ))}
        </div>
      }
      type="info"
      showIcon
      icon={icon}
      style={{ marginBottom: 24 }}
    />
  );
}
