"use client";

import { Alert, Card, Space, Spin, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  RoadmapNodeDrawer,
  type RoadmapNodeDetailValues,
} from "@/components/roadmap/RoadmapNodeDrawer";
import { RoadmapTree } from "@/components/roadmap/RoadmapTree";
import { getCurrentProfile } from "@/lib/auth-client";
import { roadmapNodeSelect } from "@/lib/report-helpers";
import { supabase } from "@/lib/supabase";
import type { RoadmapNode, WhitelistUser } from "@/lib/types";

const { Title } = Typography;

function getDescendantIds(allNodes: RoadmapNode[], parentId: string): Set<string> {
  const result = new Set<string>();
  for (const child of allNodes.filter((n) => n.parent_id === parentId)) {
    result.add(child.id);
    for (const id of getDescendantIds(allNodes, child.id)) {
      result.add(id);
    }
  }
  return result;
}

function getNodePosition(node?: RoadmapNode) {
  return {
    x: node?.position_x ?? 0,
    y: node?.position_y ?? 0,
  };
}

export default function RoadmapPage() {
  const [currentUser, setCurrentUser] = useState<WhitelistUser | null>(null);
  const [nodes, setNodes] = useState<RoadmapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerNode, setDrawerNode] = useState<RoadmapNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    const profileResult = await getCurrentProfile();
    setCurrentUser(profileResult.profile);

    if (profileResult.error || !profileResult.profile) {
      setError(profileResult.error || "Cannot load current user.");
      setLoading(false);
      return;
    }

    const { data, error: nodesError } = await supabase
      .from("roadmap_nodes")
      .select(roadmapNodeSelect)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (nodesError) {
      setError(
        `Cannot load roadmap. Run supabase/phase6-roadmap.sql in Supabase if the table is missing. ${nodesError.message}`,
      );
    } else {
      setNodes((data ?? []) as RoadmapNode[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const canEdit = currentUser?.role === "Leader";

  async function createNode(parentId: string | null) {
    if (!currentUser || !canEdit) return;
    setCreating(true);
    setError(null);

    const parent = nodes.find((n) => n.id === parentId);
    const siblings = nodes.filter((n) => n.parent_id === parentId);
    const parentPosition = getNodePosition(parent);
    const side = siblings.length % 2 === 0 ? 1 : -1;
    const depthOffset = Math.ceil((siblings.length + 1) / 2) - 1;
    const position = parentId
      ? {
          x: parentPosition.x + side * 320,
          y: parentPosition.y + depthOffset * 120,
        }
      : {
          x: 0,
          y: nodes.filter((n) => !n.parent_id).length * 220,
        };

    const { data: inserted, error: insertError } = await supabase
      .from("roadmap_nodes")
      .insert({
        created_by: currentUser.email,
        description: null,
        parent_id: parentId,
        position_x: position.x,
        position_y: position.y,
        resource_links: null,
        sort_order: siblings.length,
        title: "New topic",
      })
      .select(roadmapNodeSelect)
      .single();

    setCreating(false);
    if (insertError || !inserted) {
      setError(insertError?.message || "Cannot add node.");
      return;
    }

    setNodes((prev) => [...prev, inserted as RoadmapNode]);
    setSelectedNodeId(inserted.id);
    setEditingNodeId(inserted.id);
  }

  async function deleteNode(nodeId: string) {
    setDeletingId(nodeId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("roadmap_nodes")
      .delete()
      .eq("id", nodeId);

    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const idsToRemove = getDescendantIds(nodes, nodeId);
    idsToRemove.add(nodeId);
    setNodes((prev) => prev.filter((n) => !idsToRemove.has(n.id)));
    setSelectedNodeId((current) => (idsToRemove.has(current ?? "") ? null : current));
    setDrawerNode((current) =>
      current && idsToRemove.has(current.id) ? null : current,
    );
  }

  async function saveNodePosition(
    nodeId: string,
    position: { x: number; y: number },
  ) {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, position_x: position.x, position_y: position.y }
          : node,
      ),
    );

    const { error: updateError } = await supabase
      .from("roadmap_nodes")
      .update({
        position_x: position.x,
        position_y: position.y,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nodeId);

    if (updateError) {
      setError(updateError.message);
      await loadData();
      return;
    }

    setDrawerNode(null);
  }

  async function saveNodeTitle(nodeId: string, title: string) {
    setError(null);
    const updatedAt = new Date().toISOString();
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, title, updated_at: updatedAt } : node,
      ),
    );
    setDrawerNode((current) =>
      current?.id === nodeId ? { ...current, title, updated_at: updatedAt } : current,
    );
    setEditingNodeId(null);

    const { error: updateError } = await supabase
      .from("roadmap_nodes")
      .update({ title, updated_at: updatedAt })
      .eq("id", nodeId);

    if (updateError) {
      setError(updateError.message);
      await loadData();
    }
  }

  async function saveNodeDetail(nodeId: string, values: RoadmapNodeDetailValues) {
    setSavingDetail(true);
    setError(null);

    const updatedAt = new Date().toISOString();
    const resourceLinks = (values.resource_links ?? [])
      .map((item) => item.url.trim())
      .filter(Boolean);
    const patch = {
      description: values.description?.trim() || null,
      resource_links: resourceLinks.length ? resourceLinks : null,
      updated_at: updatedAt,
    };

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node,
      ),
    );
    setDrawerNode((current) =>
      current?.id === nodeId ? { ...current, ...patch } : current,
    );

    const { error: updateError } = await supabase
      .from("roadmap_nodes")
      .update(patch)
      .eq("id", nodeId);

    setSavingDetail(false);
    if (updateError) {
      setError(updateError.message);
      await loadData();
    }
  }

  return (
    <AppShell currentUser={currentUser}>
      {loading ? (
        <div className="flex min-h-105 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <Space orientation="vertical" size="large" className="w-full">
          {error ? <Alert showIcon title={error} type="warning" /> : null}
          <Card
            className="page-card"
            title={
              <Title className="mb-0 text-slate-950" level={3}>
                Roadmap
              </Title>
            }
          >
            <RoadmapTree
              canEdit={canEdit}
              creating={creating}
              deletingId={deletingId}
              editingNodeId={editingNodeId}
              nodes={nodes}
              onAddChild={(parentId) => {
                void createNode(parentId);
              }}
              onAddRoot={() => {
                void createNode(null);
              }}
              onDeleteNode={deleteNode}
              onOpenDetail={setDrawerNode}
              onPositionChange={(nodeId, position) => {
                void saveNodePosition(nodeId, position);
              }}
              onSelectNode={(node) => {
                setSelectedNodeId(node?.id ?? null);
              }}
              onTitleChange={(nodeId, title) => {
                void saveNodeTitle(nodeId, title);
              }}
              selectedNodeId={selectedNodeId}
            />
          </Card>
        </Space>
      )}

      <RoadmapNodeDrawer
        canEdit={canEdit}
        node={drawerNode}
        saving={savingDetail}
        onClose={() => setDrawerNode(null)}
        onSave={(nodeId, values) => {
          void saveNodeDetail(nodeId, values);
        }}
      />

    </AppShell>
  );
}
