"use client";

import { Card, Descriptions, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { AppBackButton } from "@/components/AppBackButton";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-format";
import type { ReportLog, WhitelistUser } from "@/lib/types";

const { Paragraph, Text } = Typography;

type ReportDetailCardProps = {
  backHref?: string;
  extra?: ReactNode;
  member?: WhitelistUser | null;
  report: ReportLog;
};

function renderText(value?: string | null) {
  return value ? (
    <Paragraph className="mb-0">{value}</Paragraph>
  ) : (
    <Text type="secondary">-</Text>
  );
}

export function ReportDetailCard({
  backHref,
  extra,
  member,
  report,
}: ReportDetailCardProps) {
  return (
    <Card
      className="page-card"
      extra={extra}
      title={
        <Space size="middle">
          {backHref ? (
            <AppBackButton fallbackHref={backHref} />
          ) : null}
          <span>Report detail</span>
        </Space>
      }
    >
      <Descriptions
        bordered
        column={1}
        styles={{
          label: { background: "#f8fafc", color: "#5b6475", width: 150 },
        }}
      >
        <Descriptions.Item label="Member">
          <Space orientation="vertical" size={0}>
            <Text strong>{member?.name || report.member_email}</Text>
            <Text type="secondary">{report.member_email}</Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Date">
          {formatDisplayDate(report.date)}
        </Descriptions.Item>
        <Descriptions.Item label="Content">
          {renderText(report.content)}
        </Descriptions.Item>
        <Descriptions.Item label="Output">
          {renderText(report.output)}
        </Descriptions.Item>
        <Descriptions.Item label="Evidence">
          {report.evidence_link ? (
            <a href={report.evidence_link} target="_blank" rel="noreferrer">
              {report.evidence_link}
            </a>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Blocker">
          {renderText(report.blocker)}
        </Descriptions.Item>
        <Descriptions.Item label="Follow-up">
          {renderText(report.follow_up)}
        </Descriptions.Item>
        <Descriptions.Item label="Created by">
          <Tag>{report.created_by}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Created at">
          {formatDisplayDateTime(report.created_at)}
        </Descriptions.Item>
        <Descriptions.Item label="Updated at">
          {formatDisplayDateTime(report.updated_at)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
