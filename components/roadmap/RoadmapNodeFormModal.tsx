"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Modal, Space } from "antd";
import { useEffect } from "react";
import type { RoadmapNode } from "@/lib/types";

const { TextArea } = Input;

export type RoadmapNodeFormValues = {
  description?: string;
  resource_links?: { url: string }[];
  sort_order: number;
  title: string;
};

type Props = {
  node?: RoadmapNode | null;
  onCancel: () => void;
  onSave: (values: RoadmapNodeFormValues) => void;
  open: boolean;
  parentTitle?: string | null;
  saving?: boolean;
};

export function RoadmapNodeFormModal({
  node,
  onCancel,
  onSave,
  open,
  parentTitle,
  saving,
}: Props) {
  const [form] = Form.useForm<RoadmapNodeFormValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        description: node?.description ?? undefined,
        resource_links: node?.resource_links?.map((url) => ({ url })) ?? [],
        sort_order: node?.sort_order ?? 0,
        title: node?.title ?? "",
      });
    } else {
      form.resetFields();
    }
  }, [open, node, form]);

  const modalTitle = node
    ? "Edit node"
    : parentTitle
      ? `Add child to "${parentTitle}"`
      : "Add root node";

  return (
    <Modal
      confirmLoading={saving}
      destroyOnHidden
      okText={node ? "Save" : "Add"}
      open={open}
      title={modalTitle}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Form.Item label="Title" name="title" rules={[{ required: true }]}>
          <Input placeholder="Node title" />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <TextArea placeholder="Optional context or explanation" rows={3} />
        </Form.Item>

        <Form.List name="resource_links">
          {(fields, { add, remove }) => (
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-slate-700">
                Resource links
              </div>
              <Space direction="vertical" size="small" className="w-full">
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" className="w-full">
                    <Form.Item
                      {...field}
                      className="mb-0 flex-1"
                      name={[field.name, "url"]}
                      rules={[{ message: "Enter a URL", required: true }]}
                    >
                      <Input className="w-72" placeholder="https://..." />
                    </Form.Item>
                    <Button
                      aria-label="Remove link"
                      danger
                      icon={<MinusCircleOutlined />}
                      type="text"
                      onClick={() => remove(field.name)}
                    />
                  </Space>
                ))}
                <Button
                  icon={<PlusOutlined />}
                  type="dashed"
                  onClick={() => add()}
                >
                  Add link
                </Button>
              </Space>
            </div>
          )}
        </Form.List>

        <Form.Item label="Sort order" name="sort_order">
          <InputNumber min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
