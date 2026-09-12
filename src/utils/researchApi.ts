import type { ResearchProject, ResearchProjectInput, TrendResponse } from '../types';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { message?: string };
    return new Error(body.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function listResearchProjects(): Promise<ResearchProject[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) throw await parseError(response, 'Failed to load research projects');
  const data = await response.json() as { projects: ResearchProject[] };
  return data.projects;
}

export async function createResearchProject(input: ResearchProjectInput): Promise<ResearchProject> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw await parseError(response, 'Failed to create research project');
  const data = await response.json() as { project: ResearchProject };
  return data.project;
}

export async function deleteResearchProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  if (!response.ok) throw await parseError(response, 'Failed to delete research project');
}

export async function fetchTrends(days = 14, subreddit?: string): Promise<TrendResponse> {
  const params = new URLSearchParams({ days: String(days) });
  if (subreddit?.trim()) params.set('subreddit', subreddit.trim().replace(/^\/?r\//i, ''));

  const response = await fetch(`/api/trends?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to load trend history');
  return response.json() as Promise<TrendResponse>;
}
