"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useRouter } from "next/navigation";

type AppBackButtonProps = {
  ariaLabel?: string;
  fallbackHref: string;
};

export function AppBackButton({ ariaLabel = "Back", fallbackHref }: AppBackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin)
    ) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <Button
      aria-label={ariaLabel}
      className="card-title-back-button"
      icon={<ArrowLeftOutlined />}
      onClick={handleClick}
    />
  );
}
