import { useState } from 'react';
import type { ResearchProject, ResearchProjectInput, SignalFilter, SortMode } from '../types';

interface ResearchProjectsPanelProps {
  projects: ResearchProject[];
  subreddits: string[];
  query: string;
  minScore: number;
  minComments: number;
  signalFilter: SignalFilter;
  sortMode: SortMode;
  onCreate: (project: ResearchProjectInput) => Promise<void>;
  onLoad: (project: ResearchProject) => void;
  onDelete: (projectId: string) => Promise<void>;
  isLoading: boolean;
}

export function ResearchProjectsPanel({
  projects,
  subreddits,
  query,
  minScore,
  minComments,
  signalFilter,
  sortMode,
  onCreate,
  onLoad,
  onDelete,
  isLoading,
}: ResearchProjectsPanelProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage('Give this research project a name first.');
      return;
    }

    const keywordSource = keywords.trim() || query.trim();
    const parsedKeywords = keywordSource
      ? keywordSource.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30)
      : [];

    try {
      setMessage('');
      await onCreate({
        name: trimmedName,
        description: description.trim(),
        subreddits,
        keywords: parsedKeywords,
        minScore,
        minComments,
        signalFilter,
        sortMode,
      });
      setName('');
      setDescription('');
      setKeywords('');
      setMessage('Research project saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save research project.');
    }
  };

  return (
    <section className="workspace-grid">
      <div className="card workspace-card">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Saved research</div>
            <h3>Turn this search into a reusable project</h3>
          </div>
        </div>

        <div className="project-form-grid">
          <label className="field-group">
            <span>Project name</span>
            <input className="input-base" value={name} onChange={(event) => setName(event.target.value)} placeholder="Kubernetes platform pain points" />
          </label>
          <label className="field-group">
            <span>Keywords, comma separated</span>
            <input className="input-base" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder={query || 'cost, migration, alternatives'} />
          </label>
          <label className="field-group project-description-field">
            <span>Description</span>
            <input className="input-base" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What you are trying to learn or validate" />
          </label>
        </div>

        <div className="project-config-summary">
          <span>{subreddits.length} communities</span>
          <span>score ≥ {minScore}</span>
          <span>comments ≥ {minComments}</span>
          <span>{signalFilter === 'all' ? 'all signals' : signalFilter}</span>
        </div>

        <div className="project-actions-row">
          <button className="btn-primary" onClick={handleSave} disabled={isLoading || subreddits.length === 0}>Save current research</button>
          {message && <span className="inline-status">{message}</span>}
        </div>
      </div>

      <div className="card workspace-card">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Project library</div>
            <h3>{projects.length} saved research {projects.length === 1 ? 'project' : 'projects'}</h3>
          </div>
        </div>

        <div className="project-list">
          {projects.length === 0 ? (
            <div className="empty-copy">Save a research setup and it will appear here.</div>
          ) : projects.slice(0, 8).map((project) => (
            <div className="project-row" key={project._id}>
              <div className="project-row-copy">
                <strong>{project.name}</strong>
                <span>
                  {project.subreddits.slice(0, 3).map((subreddit) => `r/${subreddit}`).join(' • ')}
                  {project.subreddits.length > 3 ? ` +${project.subreddits.length - 3}` : ''}
                </span>
                {project.keywords.length > 0 && <small>{project.keywords.join(' · ')}</small>}
              </div>
              <div className="project-row-actions">
                <button className="btn-secondary compact-button" onClick={() => onLoad(project)}>Load</button>
                <button className="text-button danger" onClick={() => void onDelete(project._id)} aria-label={`Delete ${project.name}`}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
