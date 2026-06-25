"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { RoadmapDescriptionEditor } from "@/components/roadmap/RoadmapDescriptionEditor";
import type { RoadmapNode } from "@/lib/types";

const { Text } = Typography;

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
  const [mounted, setMounted] = useState(false);
  const formId = node ? `roadmap-node-detail-form-${node.id}` : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <Drawer
      extra={
        canEdit && node ? (
          <Button
            form={formId}
            htmlType="submit"
            loading={saving}
            type="primary"
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
            id={formId}
            key={node.id}
            initialValues={{
              description: node.description ?? "",
              resource_links: node.resource_links?.map((url) => ({ url })) ?? [],
            }}
            layout="vertical"
            onFinish={(values) => onSave(node.id, values)}
          >
            <Form.Item label="Description" name="description">
              <RoadmapDescriptionEditor />
            </Form.Item>

            <Form.List name="resource_links">
              {(fields, { add, remove }) => (
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    Resource links
                  </div>
                  <Space orientation="vertical" size="small" className="w-full">
                    {fields.map((field) => {
                      const { key, ...fieldProps } = field;

                      return (
                        <div
                          key={key}
                          className="roadmap-resource-link-row"
                          style={{ alignItems: "center", display: "flex", gap: 8 }}
                        >
                          <Form.Item
                            {...fieldProps}
                            className="mb-0 flex-1"
                            name={[field.name, "url"]}
                            rules={[{ message: "Enter a URL", required: true }]}
                            style={{ flex: 1, marginBottom: 0, minWidth: 0 }}
                          >
                            <Input placeholder="https://..." />
                          </Form.Item>
                          <Button
                            aria-label="Remove link"
                            danger
                            icon={<DeleteOutlined />}
                            style={{ flex: "0 0 auto" }}
                            type="text"
                            onClick={() => remove(field.name)}
                          />
                        </div>
                      );
                    })}
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
                <div
                  className="roadmap-rich-content"
                  dangerouslySetInnerHTML={{ __html: node.description }}
                />
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
