import api from "./api";

export interface Memory {
  id: number;
  category: "profile" | "preference" | "skill" | "project" | string;
  key: string;
  value: string;
  updated_at: string | null;
}

export async function getMemories(): Promise<Memory[]> {
  const res = await api.get("/memories");
  return res.data;
}

export async function addMemory(
  category: string,
  key: string,
  value: string
): Promise<Memory> {
  const res = await api.post("/memories", { category, key, value });
  return res.data;
}

export async function updateMemory(
  id: number,
  value: string
): Promise<Memory> {
  const res = await api.put(`/memories/${id}`, { value });
  return res.data;
}

export async function deleteMemory(id: number): Promise<void> {
  await api.delete(`/memories/${id}`);
}