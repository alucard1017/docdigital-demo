// src/api/users.js
import api from "./client";

export async function getUsers(roleFilter) {
  const params = {};
  if (roleFilter) params.role = roleFilter;

  const res = await api.get("/users", { params });
  return res.data;
}

export async function saveUser(user) {
  if (user.id) {
    const res = await api.put(`/users/${user.id}`, user);
    return res.data;
  }
  const res = await api.post("/users", user);
  return res.data;
}

export async function deleteUser(id) {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}

export async function resetUserPassword(id) {
  const res = await api.post(`/users/${id}/reset-password`);
  return res.data;
}
