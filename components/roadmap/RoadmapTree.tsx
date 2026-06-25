"use client";

import {
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import { Button, Empty, Popconfirm } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoadmapNode } from "@/lib/types";

type Props = {
  canEdit: boolean;
  creating: boolean;
  deletingId: string | null;
  editingNodeId: string | null;
  nodes: RoadmapNode[];
  onAddChild: (parentId: string) => void;
  onAddRoot: () => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenDetail: (node: RoadmapNode) => void;
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  onSelectNode: (node: RoadmapNode | null) => void;
  onTitleChange: (nodeId: string, title: string) => void;
  selectedNodeId: string | null;
};

function sortNodes(items: RoadmapNode[]) {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );
}

function groupByParent(nodes: RoadmapNode[]) {
  const grouped = new Map<string | null, RoadmapNode[]>();

  for (const node of nodes) {
    const parentId = node.parent_id ?? null;
    const current = grouped.get(parentId) ?? [];
    current.push(node);
    grouped.set(parentId, current);
  }

  for (const [parentId, children] of grouped) {
    grouped.set(parentId, sortNodes(children));
  }

  return grouped;
}

function fallbackPosition(
  node: RoadmapNode,
  grouped: Map<string | null, RoadmapNode[]>,
  nodeMap: Map<string, RoadmapNode>,
): { x: number; y: number } {
  if (node.position_x !== null && node.position_y !== null) {
    return { x: node.position_x, y: node.position_y };
  }

  if (!node.parent_id) {
    const roots = grouped.get(null) ?? [];
    const rootIndex = roots.findIndex((root) => root.id === node.id);
    return { x: 0, y: rootIndex * 220 };
  }

  const parent = nodeMap.get(node.parent_id);
  const parentPosition = parent
    ? fallbackPosition(parent, grouped, nodeMap)
    : { x: 0, y: 0 };
  const siblings = grouped.get(node.parent_id) ?? [];
  const siblingIndex = siblings.findIndex((sibling) => sibling.id === node.id);
  const side = siblingIndex % 2 === 0 ? 1 : -1;
  const depthOffset = Math.ceil((siblingIndex + 1) / 2);

  return {
    x: parentPosition.x + side * 320,
    y: parentPosition.y + (depthOffset - 1) * 120,
  };
}

export function RoadmapTree({
  canEdit,
  creating,
  deletingId,
  editingNodeId,
  nodes,
  onAddChild,
  onAddRoot,
  onDeleteNode,
  onOpenDetail,
  onPositionChange,
  onSelectNode,
  onTitleChange,
  selectedNodeId,
}: Props) {
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [handledEditingNodeId, setHandledEditingNodeId] = useState<string | null>(null);
  const skipNextBlurSaveRef = useRef(false);

  const startTitleEdit = useCallback((node: RoadmapNode) => {
    setEditingTitleId(node.id);
  }, []);

  const cancelTitleEdit = useCallback(() => {
    setEditingTitleId(null);
  }, []);

  const saveTitleEdit = useCallback((node: RoadmapNode, rawTitle: string) => {
    const nextTitle = rawTitle.trim();
    if (!nextTitle || nextTitle === node.title) {
      cancelTitleEdit();
      return;
    }

    onTitleChange(node.id, nextTitle);
    cancelTitleEdit();
  }, [cancelTitleEdit, onTitleChange]);

  useEffect(() => {
    if (
      !editingNodeId ||
      editingTitleId === editingNodeId ||
      handledEditingNodeId === editingNodeId
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const node = nodes.find((item) => item.id === editingNodeId);
      if (node) {
        setHandledEditingNodeId(editingNodeId);
        startTitleEdit(node);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    editingNodeId,
    editingTitleId,
    handledEditingNodeId,
    nodes,
    startTitleEdit,
  ]);

  const { edges, initialFlowNodes, nodeById } = useMemo(() => {
    const grouped = groupByParent(nodes);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const nextNodes: Node[] = nodes.map((node) => ({
      id: node.id,
      className: [
        "roadmap-flow-node",
        node.parent_id ? "" : "roadmap-flow-root",
        selectedNodeId === node.id ? "roadmap-flow-selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
      data: {
        label: (
          <div className="roadmap-flow-node-content">
            {editingTitleId === node.id ? (
              <input
                autoFocus
                className="roadmap-flow-title-input nodrag nopan"
                defaultValue={node.title}
                onBlur={(event) => {
                  if (skipNextBlurSaveRef.current) {
                    skipNextBlurSaveRef.current = false;
                    return;
                  }
                  saveTitleEdit(node, event.currentTarget.value);
                }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveTitleEdit(node, event.currentTarget.value);
                  }
                  if (event.key === "Escape") {
                    skipNextBlurSaveRef.current = true;
                    cancelTitleEdit();
                  }
                }}
              />
            ) : (
              <button
                className="roadmap-flow-node-title nodrag nopan"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNode(node);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (canEdit) startTitleEdit(node);
                }}
              >
                {node.title}
              </button>
            )}
            <Button
              aria-label="View node details"
              className="roadmap-flow-detail-button nodrag nopan"
              icon={<InfoCircleOutlined />}
              size="small"
              type="text"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(node);
              }}
            />
            {canEdit ? (
              <div
                className="roadmap-flow-node-actions nodrag nopan"
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  aria-label="Add child node"
                  icon={<PlusOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onAddChild(node.id)}
                />
                <Button
                  aria-label="Edit node"
                  icon={<EditOutlined />}
                  size="small"
                  type="text"
                  onClick={() => startTitleEdit(node)}
                />
                <Popconfirm
                  cancelText="Cancel"
                  description="This will also delete all child nodes."
                  okText="Delete"
                  okType="danger"
                  title="Delete this node?"
                  onConfirm={() => onDeleteNode(node.id)}
                >
                  <Button
                    aria-label="Delete node"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === node.id}
                    size="small"
                    type="text"
                  />
                </Popconfirm>
              </div>
            ) : null}
          </div>
        ),
      },
      draggable: canEdit,
      position: fallbackPosition(node, grouped, nodeMap),
      type: "default",
    }));

    const nextEdges: Edge[] = nodes
      .filter((node) => node.parent_id)
      .map((node) => ({
        id: `${node.parent_id}-${node.id}`,
        source: node.parent_id as string,
        target: node.id,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#8b5cf6", strokeWidth: 3 },
      }));

    return {
      edges: nextEdges,
      initialFlowNodes: nextNodes,
      nodeById: nodeMap,
    };
  }, [
    canEdit,
    cancelTitleEdit,
    deletingId,
    editingTitleId,
    nodes,
    onAddChild,
    onDeleteNode,
    onOpenDetail,
    onSelectNode,
    saveTitleEdit,
    selectedNodeId,
    startTitleEdit,
  ]);

  const [flowNodes, setFlowNodes] = useState<Node[]>(initialFlowNodes);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFlowNodes(initialFlowNodes);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialFlowNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const handleNodeDragStop: OnNodeDrag = (_, node) => {
    if (!canEdit || !nodeById.has(node.id)) return;
    onPositionChange(node.id, {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    });
  };

  if (!nodes.length) {
    return (
      <div className="muted-panel roadmap-flow-empty">
        <Empty description="No roadmap nodes yet" />
        {canEdit ? (
          <Button
            className="roadmap-add-root-button"
            icon={<PlusOutlined />}
            loading={creating}
            type="primary"
            onClick={onAddRoot}
          >
            Add root
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="roadmap-flow-shell">
      {canEdit ? (
        <Button
          className="roadmap-add-root-button"
          icon={<PlusOutlined />}
          loading={creating}
          type="primary"
          onClick={onAddRoot}
        >
          Add root
        </Button>
      ) : null}
      <ReactFlowProvider>
        <ReactFlow
          fitView
          nodes={flowNodes}
          edges={edges}
          minZoom={0.35}
          maxZoom={1.6}
          nodesDraggable={canEdit}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const found = nodeById.get(node.id);
            if (found) onSelectNode(found);
          }}
          onNodeDoubleClick={(_, node) => {
            const found = nodeById.get(node.id);
            if (found && canEdit) startTitleEdit(found);
          }}
          onNodeDragStop={handleNodeDragStop}
          onNodesChange={handleNodesChange}
          onPaneClick={() => onSelectNode(null)}
        >
          <Background color="#dbeafe" gap={28} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
