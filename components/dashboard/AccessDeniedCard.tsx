"use client";

import { Alert, Button, Card } from "antd";

type AccessDeniedCardProps = {
  error?: string | null;
  onSignOut: () => void;
};

export function AccessDeniedCard({ error, onSignOut }: AccessDeniedCardProps) {
  return (
    <Card className="mx-auto mt-20 max-w-xl">
      <Alert
        type="error"
        showIcon
        title="Access denied"
        description={error || "Your email is not in the active FE team whitelist."}
      />
      <Button className="mt-4" onClick={onSignOut}>
        Sign out
      </Button>
    </Card>
  );
}
