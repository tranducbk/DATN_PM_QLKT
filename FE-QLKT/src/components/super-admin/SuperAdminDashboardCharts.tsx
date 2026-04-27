'use client';

import { Row, Col, Card } from 'antd';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { getActionLabel } from '@/components/system-logs/constants';
import { ROLE_LABELS } from '@/constants/roles.constants';
import '@/lib/chartConfig';

interface RoleDistributionItem {
  role: string;
  count: number;
}
interface DailyActivityItem {
  date: string;
  count: number;
}
interface LogsByActionItem {
  action: string;
  count: number;
}
interface NewAccountsByDateItem {
  date: string;
  count: number;
}

export interface SuperAdminDashboardChartData {
  roleDistribution: RoleDistributionItem[];
  dailyActivity: DailyActivityItem[];
  logsByAction: LogsByActionItem[];
  newAccountsByDate: NewAccountsByDateItem[];
}

interface SuperAdminDashboardChartsProps {
  chartData: SuperAdminDashboardChartData;
  theme: string;
}

export default function SuperAdminDashboardCharts({
  chartData,
  theme,
}: SuperAdminDashboardChartsProps) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const roleChartData = {
    labels:
      chartData.roleDistribution.length > 0
        ? chartData.roleDistribution.map(item => ROLE_LABELS[item.role] || item.role)
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data:
          chartData.roleDistribution.length > 0
            ? chartData.roleDistribution.map(item => item.count)
            : [0],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(249, 115, 22, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const roleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Phân bố vai trò',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
  };

  const activityChartData = {
    labels:
      chartData.dailyActivity.length > 0
        ? chartData.dailyActivity.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          })
        : [],
    datasets: [
      {
        label: 'Số lượng hoạt động',
        data:
          chartData.dailyActivity.length > 0
            ? chartData.dailyActivity.map(item => item.count)
            : [],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const activityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
        },
      },
      title: {
        display: true,
        text: 'Hoạt động hệ thống (7 ngày gần nhất)',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  const logsChartData = {
    labels:
      chartData.logsByAction.length > 0
        ? chartData.logsByAction.map(item => {
            const label = getActionLabel(item.action?.toUpperCase() || '');
            return label.length > 20 ? label.substring(0, 20) + '...' : label;
          })
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data:
          chartData.logsByAction.length > 0
            ? chartData.logsByAction.map(item => item.count)
            : [0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 4,
        maxBarThickness: 60,
      },
    ],
  };

  const logsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top 10 hành động phổ biến',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Số lượng',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        title: {
          display: true,
          text: 'Hành động',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          color: textColor,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  const accountsChartData = {
    labels:
      chartData.newAccountsByDate.length > 0
        ? chartData.newAccountsByDate.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          })
        : [],
    datasets: [
      {
        label: 'Tài khoản mới',
        data:
          chartData.newAccountsByDate.length > 0
            ? chartData.newAccountsByDate.map(item => item.count)
            : [],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(34, 197, 94, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const accountsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
        },
      },
      title: {
        display: true,
        text: 'Tài khoản mới (30 ngày gần nhất)',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card>
            <div style={{ height: '250px' }}>
              <Doughnut data={roleChartData} options={roleChartOptions} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <div style={{ height: '250px' }}>
              <Line data={activityChartData} options={activityChartOptions} />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card>
            <div style={{ height: '250px' }}>
              <Bar data={logsChartData} options={logsChartOptions} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <div style={{ height: '250px' }}>
              <Line data={accountsChartData} options={accountsChartOptions} />
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
