"use client";

import { Card, Typography } from "antd";

const { Text, Title } = Typography;

type DashboardMetricsProps = {
  needReviewCount: number;
  overdueChecklistsCount: number;
  totalMembers: number;
};

export function DashboardMetrics({
  needReviewCount,
  overdueChecklistsCount,
  totalMembers,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="metric-card metric-card-blue">
        <Text className="metric-label">Total members</Text>
        <Title level={1} className="metric-value">
          {totalMembers}
        </Title>
        <Text className="metric-subtitle">Active FE members</Text>
      </Card>
      <Card className="metric-card metric-card-orange">
        <Text className="metric-label">Need review</Text>
        <Title level={1} className="metric-value">
          {needReviewCount}
        </Title>
        <Text className="metric-subtitle metric-subtitle-warning">
          Action required
        </Text>
      </Card>
      <Card className="metric-card metric-card-green">
        <Text className="metric-label">Overdue checklists</Text>
        <Title level={1} className="metric-value">
          {overdueChecklistsCount}
        </Title>
        <Text className="metric-subtitle metric-subtitle-success">
          Need follow-up
        </Text>
      </Card>
    </div>
  );
}
