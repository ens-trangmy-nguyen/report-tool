"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Space, Typography } from "antd";
import { useEffect } from "react";
import type { RoadmapNode } from "@/lib/types";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

export type RoadmapNodeDetailValues = {
  description?: string;
  resource_links?: { url: string }[];
};

type Props = {
  canEdit: boolean;
  node: RoadmapNode | null;
  onClose: () => void;
  onSave: (nodeId: string, values: RoadmapNodeDetailValues) => void;
  saving?: boolean;
};

export function RoadmapNodeDrawer({
  canEdit,
  node,
  onClose,
  onSave,
  saving,
}: Props) {
  const [form] = Form.useForm<RoadmapNodeDetailValues>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (node) {
        form.setFieldsValue({
          description: node.description ?? "",
          resource_links: node.resource_links?.map((url) => ({ url })) ?? [],
        });
      } else {
        form.resetFields();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [form, node]);

  return (
    <Drawer
      extra={
        canEdit && node ? (
          <Button
            loading={saving}
            type="primary"
            onClick={() => form.submit()}
          >
            Save
          </Button>
        ) : null
      }
      open={Boolean(node)}
      title={node?.title ?? ""}
      size={440}
      onClose={onClose}
    >
      {node ? (
        canEdit ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => onSave(node.id, values)}
          >
            <Form.Item label="Description" name="description">
              <TextArea
                placeholder="What should the team learn or know in this topic?"
                rows={5}
              />
            </Form.Item>

            <Form.List name="resource_links">
              {(fields, { add, remove }) => (
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    Resource links
                  </div>
                  <Space orientation="vertical" size="small" className="w-full">
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline" className="w-full">
                        <Form.Item
                          {...field}
                          className="mb-0 flex-1"
                          name={[field.name, "url"]}
                          rules={[{ message: "Enter a URL", required: true }]}
                        >
                          <Input placeholder="https://..." />
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
          </Form>
        ) : (
          <Space orientation="vertical" size="large" className="w-full">
            {node.description ? (
              <div>
                <Text strong className="mb-1 block">
                  Description
                </Text>
                <Paragraph className="mb-0">{node.description}</Paragraph>
              </div>
            ) : null}

            {node.resource_links?.length ? (
              <div>
                <Text strong className="mb-2 block">
                  Resources
                </Text>
                <Space orientation="vertical" size="small" className="w-full">
                  {node.resource_links.map((link) => (
                    <a
                      key={link}
                      className="break-all text-blue-600 hover:underline"
                      href={link}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {link}
                    </a>
                  ))}
                </Space>
              </div>
            ) : null}

            {!node.description && !node.resource_links?.length ? (
              <Text className="text-slate-400">
                No description or resources added yet.
              </Text>
            ) : null}
          </Space>
        )
      ) : null}
    </Drawer>
  );
}
