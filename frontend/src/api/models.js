import { apiClient } from "./client";

export async function fetchModels() {
  const res = await apiClient.get("/api/models");
  return res.data?.models ?? [];
}
