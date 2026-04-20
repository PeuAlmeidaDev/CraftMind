"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getToken } from "@/lib/client-auth";

export type Friend = {
  friendshipId: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    level: number;
    houseName: string | null;
  };
};

export type FriendRequest = {
  id: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    level: number;
    houseName: string | null;
  };
};

type FriendsResponse = { data: Friend[] };
type RequestsResponse = { data: FriendRequest[] };

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-item loading states keyed by id
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    const token = getToken();
    if (!token) {
      setError("Sessao expirada");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const opts: RequestInit = {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        signal,
      };

      const [friendsRes, requestsRes] = await Promise.all([
        fetch("/api/friends", opts),
        fetch("/api/friends/requests", opts),
      ]);

      if (signal?.aborted) return;

      if (friendsRes.status === 401 || requestsRes.status === 401) {
        setError("Sessao expirada");
        setLoading(false);
        return;
      }

      if (!friendsRes.ok || !requestsRes.ok) {
        setError("Erro ao carregar amigos");
        setLoading(false);
        return;
      }

      const friendsJson = (await friendsRes.json()) as FriendsResponse;
      const requestsJson = (await requestsRes.json()) as RequestsResponse;

      if (signal?.aborted) return;

      setFriends(friendsJson.data);
      setPendingRequests(requestsJson.data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Erro de conexao");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  const refresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAll(controller.signal);
  }, [fetchAll]);

  const acceptRequest = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;

    setAcceptingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/friends/request/${id}/accept`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) return;

      // Remove from pending and re-fetch friends to get updated list
      setPendingRequests((prev) => prev.filter((r) => r.id !== id));

      // Optimistic: re-fetch full list to sync
      const friendsRes = await fetch("/api/friends", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (friendsRes.ok) {
        const json = (await friendsRes.json()) as FriendsResponse;
        setFriends(json.data);
      }
    } catch {
      // Silent fail — user can retry
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const declineRequest = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;

    setDecliningIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/friends/request/${id}/decline`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) return;

      setPendingRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Silent fail
    } finally {
      setDecliningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const removeFriend = useCallback(async (friendshipId: string) => {
    const token = getToken();
    if (!token) return;

    setRemovingIds((prev) => new Set(prev).add(friendshipId));

    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) return;

      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch {
      // Silent fail
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(friendshipId);
        return next;
      });
    }
  }, []);

  return {
    friends,
    pendingRequests,
    pendingCount: pendingRequests.length,
    loading,
    error,
    refresh,
    acceptRequest,
    declineRequest,
    removeFriend,
    acceptingIds,
    decliningIds,
    removingIds,
  };
}
