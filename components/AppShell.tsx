"use client";

import {
  BellOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Layout,
  Popover,
  Typography,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDateTime } from "@/lib/date-format";
import { notificationSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { Notification, WhitelistUser } from "@/lib/types";

const { Content, Header } = Layout;
const { Text } = Typography;

const roleLabel: Record<string, string> = {
  Admin: "Admin",
  Leader: "Leader",
  Member: "Member",
};

type AppShellProps = {
  children: ReactNode;
  currentUser?: WhitelistUser | null;
};

export function AppShell({ children, currentUser }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isDashboard = pathname === "/" || pathname === "/my/dashboard";
  const isChecklists =
    pathname.startsWith("/checklists") || pathname.startsWith("/my/checklists");
  const isMembers = pathname.startsWith("/members");
  const isMyReports = pathname.startsWith("/my/reports");
  const isReports = pathname.startsWith("/reports");
  const isRoadmap = pathname.startsWith("/roadmap");
  const contentWidthClass = isRoadmap ? "max-w-[calc(100vw-48px)]" : "max-w-6xl";
  const canViewTeam =
    currentUser?.role === "Leader" || currentUser?.role === "Admin";
  const activeNavClass =
    "!rounded-full !bg-blue-100 !px-5 !font-semibold !text-blue-700";
  const inactiveNavClass = "!font-semibold !text-slate-700";
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const currentUserEmail = currentUser?.email;
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!currentUserEmail) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(notificationSelect)
      .eq("recipient_email", currentUserEmail)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      setNotificationError(error.message);
      setNotifications([]);
      return;
    }
    setNotificationError(null);
    setNotifications((data ?? []) as Notification[]);
  }, [currentUserEmail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    window.addEventListener(
      "report-tool:notifications-changed",
      loadNotifications,
    );

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(
        "report-tool:notifications-changed",
        loadNotifications,
      );
    };
  }, [loadNotifications, pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
    }
    if (notification.link_url) router.push(notification.link_url);
  }

  async function markAllNotificationsRead() {
    if (!currentUser?.email) return;
    const readAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("recipient_email", currentUser.email)
      .is("read_at", null);
    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })),
    );
  }

  const displayName = currentUser ? currentUser.name || currentUser.email : "";
  const avatarInitial = currentUser
    ? (currentUser.name || currentUser.email).charAt(0).toUpperCase()
    : "";

  const userMenuItems: MenuProps["items"] = [
    {
      key: "info",
      label: (
        <div className="py-1">
          <div className="font-semibold text-slate-900">{displayName}</div>
          {currentUser?.name ? (
            <div className="text-xs text-slate-500">{currentUser.email}</div>
          ) : null}
          <div className="mt-0.5 text-xs text-slate-400">
            {roleLabel[currentUser?.role ?? ""] ?? currentUser?.role}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "signout",
      icon: <LogoutOutlined />,
      label: "Sign out",
      onClick: signOut,
    },
  ];

  const notificationContent = (
    <div className="notification-popover">
      <div className="notification-popover-header">
        <Text strong>Notifications</Text>
        <Button
          disabled={!unreadCount}
          size="small"
          type="link"
          onClick={markAllNotificationsRead}
        >
          Mark all read
        </Button>
      </div>
      {notificationError ? (
        <div className="notification-error">
          Cannot load notifications. Run{" "}
          <strong>supabase/phase5-notifications.sql</strong>.
          <br />
          {notificationError}
        </div>
      ) : notifications.length ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              className={`notification-item ${notification.read_at ? "" : "unread"}`}
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
            >
              <div className="notification-item-title">
                {notification.title}
              </div>
              {notification.body ? (
                <div className="notification-item-body">
                  {notification.body}
                </div>
              ) : null}
              <div className="notification-item-time">
                {formatDisplayDateTime(notification.created_at)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          description="No notifications"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 6,
          colorPrimary: "#1677ff",
        },
      }}
    >
      <Layout className="app-shell min-h-screen">
        <Header
          className="app-header app-header-row"
          style={{
            left: 0,
            position: "fixed",
            right: 0,
            top: 0,
            zIndex: 1000,
          }}
        >
          <div className="app-header-brand">
            <span className="brand-mark header-brand-mark">
              <TeamOutlined />
            </span>
            <div className="leading-tight">
              <Text strong className="block text-base text-slate-950">
                Report Tool
              </Text>
              <Text className="text-xs text-slate-500">FE team tracking</Text>
            </div>
          </div>
          {currentUser ? (
            <div className="app-header-nav">
              {canViewTeam ? (
                <Link href="/">
                  <Button
                    type="text"
                    className={isDashboard ? activeNavClass : inactiveNavClass}
                  >
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/my/dashboard">
                  <Button
                    type="text"
                    className={isDashboard ? activeNavClass : inactiveNavClass}
                  >
                    Dashboard
                  </Button>
                </Link>
              )}
              {canViewTeam ? (
                <Link href="/members">
                  <Button
                    type="text"
                    className={isMembers ? activeNavClass : inactiveNavClass}
                  >
                    Members
                  </Button>
                </Link>
              ) : (
                <Link href="/my/reports">
                  <Button
                    type="text"
                    className={isMyReports ? activeNavClass : inactiveNavClass}
                  >
                    My reports
                  </Button>
                </Link>
              )}
              {canViewTeam ? (
                <Link href="/reports">
                  <Button
                    type="text"
                    className={isReports ? activeNavClass : inactiveNavClass}
                  >
                    Reports
                  </Button>
                </Link>
              ) : null}
              <Link href={canViewTeam ? "/checklists" : "/my/checklists"}>
                <Button
                  type="text"
                  className={isChecklists ? activeNavClass : inactiveNavClass}
                >
                  Checklists
                </Button>
              </Link>
              <Link href="/roadmap">
                <Button
                  type="text"
                  className={isRoadmap ? activeNavClass : inactiveNavClass}
                >
                  Roadmap
                </Button>
              </Link>
              <Popover
                content={notificationContent}
                onOpenChange={(open) => {
                  if (open) void loadNotifications();
                }}
                placement="bottomRight"
                trigger="click"
              >
                <Badge count={unreadCount} size="small">
                  <Button
                    aria-label="Notifications"
                    className="header-icon-button"
                    icon={<BellOutlined />}
                    type="text"
                  />
                </Badge>
              </Popover>
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Avatar
                  className="cursor-pointer bg-blue-600 select-none"
                  icon={!avatarInitial ? <UserOutlined /> : undefined}
                  size={36}
                >
                  {avatarInitial}
                </Avatar>
              </Dropdown>
            </div>
          ) : null}
        </Header>

        <Content className={`app-content mx-auto w-full ${contentWidthClass} px-4 pb-8 sm:px-6`}>
          {children}
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
