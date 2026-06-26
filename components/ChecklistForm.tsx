"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, DatePicker, Form, Input, Select, Space } from "antd";
import type { FormInstance } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useRef } from "react";
import type { Checklist, ChecklistItem, ChecklistScope, WhitelistUser } from "@/lib/types";

const { TextArea } = Input;

export type ChecklistFormValues = {
  assignees?: string[];
  description?: string;
  due_date: Dayjs;
  items: { title: string }[];
  scope: ChecklistScope;
  title: string;
};

type ChecklistFormProps = {
  form: FormInstance<ChecklistFormValues>;
  initialChecklist?: Checklist;
  initialItems?: ChecklistItem[];
  loading?: boolean;
  members: WhitelistUser[];
  onFinish: (values: ChecklistFormValues) => void;
  submitText: string;
};

export function ChecklistForm({
  form,
  initialChecklist,
  initialItems = [],
  loading,
  members,
  onFinish,
  submitText,
}: ChecklistFormProps) {
  const scope = Form.useWatch("scope", form);
  const itemInputRefs = useRef(new Map<number, HTMLInputElement | null>());

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        description: initialChecklist?.description ?? undefined,
        due_date: initialChecklist?.due_date ? dayjs(initialChecklist.due_date) : undefined,
        items: initialItems.length
          ? initialItems
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => ({ title: item.title }))
          : [{ title: "" }],
        scope: initialChecklist?.scope ?? "Team",
        title: initialChecklist?.title,
      }}
      onFinish={onFinish}
    >
      <Form.Item label="Title" name="title" rules={[{ required: true }]}>
        <Input placeholder="Checklist title" />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <TextArea rows={3} placeholder="Short context, if any" />
      </Form.Item>

      <Form.Item label="Scope" name="scope" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "Team", value: "Team" },
            { label: "Personal", value: "Personal" },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="Due date"
        name="due_date"
        rules={[
          { required: true, message: "Select due date" },
          {
            validator(_, value) {
              if (value && value.isBefore(dayjs(), "day")) {
                return Promise.reject(new Error("Due date must be today or a future date."));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <DatePicker
          className="w-full"
          disabledDate={(d) => d.isBefore(dayjs(), "day")}
          format="DD-MM-YYYY"
        />
      </Form.Item>

      {scope === "Personal" ? (
        <Form.Item
          label="Assign to"
          name="assignees"
          rules={[{ required: true, message: "Select at least one member" }]}
        >
          <Select
            mode="multiple"
            options={members
              .filter((member) => member.role === "Member" && member.status === "Active")
              .map((member) => ({
                label: member.name || member.email,
                value: member.email,
              }))}
            placeholder="Select members"
          />
        </Form.Item>
      ) : null}

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <Space orientation="vertical" size="small" className="w-full">
            <div className="checklist-items-label">
              <span className="text-red-500">*</span>
              <span>Checklist items</span>
            </div>
            {fields.map((field) => {
              const { key, ...fieldProps } = field;

              return (
                <div key={key} className="checklist-item-row">
                  <Form.Item
                    {...fieldProps}
                    className="mb-0 flex-1"
                    name={[field.name, "title"]}
                    rules={[{ required: true, message: "Enter item title" }]}
                  >
                    <Input
                      placeholder="Checklist item"
                      ref={(input) => {
                        itemInputRefs.current.set(key, input?.input ?? null);
                      }}
                    />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <Button
                      aria-label="Remove checklist item"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  ) : null}
                </div>
              );
            })}
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                add();
                requestAnimationFrame(() => {
                  const nextInput = Array.from(itemInputRefs.current.values()).at(-1);
                  nextInput?.focus();
                });
              }}
            >
              Add item
            </Button>
          </Space>
        )}
      </Form.List>

      <div className="checklist-form-actions">
        <Button htmlType="submit" loading={loading} type="primary">
          {submitText}
        </Button>
      </div>
    </Form>
  );
}
