"use client";

import { DatePicker, Form, Input } from "antd";
import type { FormInstance } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { ReactNode } from "react";
import type { ReportLog } from "@/lib/types";

const { TextArea } = Input;

export type ReportFormValues = {
  date: Dayjs;
  content: string;
  output?: string;
  evidence_link?: string;
  blocker?: string;
  follow_up?: string;
};

type ReportFormProps = {
  children?: ReactNode;
  form: FormInstance<ReportFormValues>;
  initialReport?: ReportLog;
  onFinish: (values: ReportFormValues) => void;
};

export function ReportForm({
  children,
  form,
  initialReport,
  onFinish,
}: ReportFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        blocker: initialReport?.blocker ?? undefined,
        content: initialReport?.content,
        date: initialReport?.date ? dayjs(initialReport.date) : dayjs(),
        evidence_link: initialReport?.evidence_link ?? undefined,
        follow_up: initialReport?.follow_up ?? undefined,
        output: initialReport?.output ?? undefined,
      }}
      onFinish={onFinish}
    >
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

      {children}
    </Form>
  );
}
