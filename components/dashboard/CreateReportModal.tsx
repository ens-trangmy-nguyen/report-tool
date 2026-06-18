"use client";

import { DatePicker, Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd";
import type { Dayjs } from "dayjs";
import { useSyncExternalStore } from "react";
import type { WhitelistUser } from "@/lib/types";

const { TextArea } = Input;

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}

export type DashboardReportFormValues = {
  blocker?: string;
  content: string;
  date: Dayjs;
  evidence_link?: string;
  follow_up?: string;
  member_email: string;
  output?: string;
};

type CreateReportModalProps = {
  activeMembers: WhitelistUser[];
  form: FormInstance<DashboardReportFormValues>;
  loading: boolean;
  onCancel: () => void;
  onCreate: (values: DashboardReportFormValues) => void;
  open: boolean;
};

export function CreateReportModal({
  activeMembers,
  form,
  loading,
  onCancel,
  onCreate,
  open,
}: CreateReportModalProps) {
  const isClient = useIsClient();

  if (!isClient) return null;

  return (
    <Modal
      title="Create report/log"
      open={open}
      okText="Create"
      width={640}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => form.submit()}
      styles={{
        body: {
          maxHeight: "calc(100vh - 240px)",
          overflowY: "auto",
          paddingRight: 8,
        },
      }}
      forceRender
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item
          label="Member"
          name="member_email"
          rules={[{ required: true, message: "Select a member" }]}
        >
          <Select
            placeholder="Select member"
            options={activeMembers
              .filter((member) => member.role === "Member")
              .map((member) => ({
                label: member.name || member.email,
                value: member.email,
              }))}
          />
        </Form.Item>

        <Form.Item
          label="Date"
          name="date"
          rules={[{ required: true, message: "Select report date" }]}
        >
          <DatePicker className="w-full" />
        </Form.Item>

        <Form.Item
          label="Content"
          name="content"
          rules={[{ required: true, message: "Enter report content" }]}
        >
          <TextArea rows={4} placeholder="What did this member work on?" />
        </Form.Item>

        <Form.Item label="Output" name="output">
          <TextArea rows={2} placeholder="Result or output, if any" />
        </Form.Item>

        <Form.Item
          label="Evidence link"
          name="evidence_link"
          rules={[{ type: "url", message: "Enter a valid URL" }]}
        >
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item label="Blocker" name="blocker">
          <TextArea rows={2} placeholder="Blocker, if any" />
        </Form.Item>

        <Form.Item label="Follow-up" name="follow_up">
          <TextArea rows={2} placeholder="Follow-up, if any" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
