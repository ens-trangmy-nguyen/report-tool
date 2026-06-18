"use client";

import { GoogleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Space, Typography } from "antd";

const { Text, Title } = Typography;

type LoginCardProps = {
  error?: string | null;
  onSignIn: () => void;
};

export function LoginCard({ error, onSignIn }: LoginCardProps) {
  return (
    <div className="flex min-h-130 items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <Space orientation="vertical" size="large" className="w-full">
          <div>
            <Title level={3}>Sign in to continue</Title>
            <Text type="secondary">
              Only whitelisted FE team emails can access this tool.
            </Text>
          </div>
          {error ? <Alert type="error" title={error} showIcon /> : null}
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={onSignIn}
          >
            Login with Google
          </Button>
        </Space>
      </Card>
    </div>
  );
}
