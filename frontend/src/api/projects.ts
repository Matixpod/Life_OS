import type {
  ProjectFull,
  ProjectSection,
  ProjectSectionCreatePayload,
  ProjectTask,
  ProjectTaskCreatePayload,
  ProjectTaskUpdatePayload,
  ProjectV2,
  ProjectV2CreatePayload,
  ProjectV2UpdatePayload,
  ReorderRequest,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function patchVoid(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

export const projectsApi = {
  list: (status?: string): Promise<ProjectV2[]> =>
    get<ProjectV2[]>(`/api/v1/projects${status ? `?status=${status}` : ''}`),
  create: (payload: ProjectV2CreatePayload): Promise<ProjectV2> => post('/api/v1/projects', payload),
  get: (id: string): Promise<ProjectFull> => get(`/api/v1/projects/${id}`),
  update: (id: string, payload: ProjectV2UpdatePayload): Promise<ProjectV2> =>
    patch(`/api/v1/projects/${id}`, payload),

  createSection: (projectId: string, payload: ProjectSectionCreatePayload): Promise<ProjectSection> =>
    post(`/api/v1/projects/${projectId}/sections`, payload),
  updateSection: (sectionId: string, payload: { title?: string; position?: number }): Promise<ProjectSection> =>
    patch(`/api/v1/projects/sections/${sectionId}`, payload),
  reorderSections: (projectId: string, payload: ReorderRequest): Promise<void> =>
    patchVoid(`/api/v1/projects/${projectId}/sections/reorder`, payload),

  createTask: (projectId: string, payload: ProjectTaskCreatePayload): Promise<ProjectTask> =>
    post(`/api/v1/projects/${projectId}/tasks`, payload),
  updateTask: (taskId: string, payload: ProjectTaskUpdatePayload): Promise<ProjectTask> =>
    patch(`/api/v1/projects/tasks/${taskId}`, payload),
  completeTask: (taskId: string): Promise<ProjectTask> =>
    post(`/api/v1/projects/tasks/${taskId}/complete`),
  reorderTasks: (sectionId: string, payload: ReorderRequest): Promise<void> =>
    patchVoid(`/api/v1/projects/sections/${sectionId}/reorder`, payload),
  deleteProject: (projectId: string): Promise<void> =>
    del(`/api/v1/projects/${projectId}`),
  deleteSection: (sectionId: string): Promise<void> =>
    del(`/api/v1/projects/sections/${sectionId}`),
  deleteTask: (taskId: string): Promise<void> =>
    del(`/api/v1/projects/tasks/${taskId}`),
};
