export type PageId =
  | 'home'
  | 'reddit'
  | 'evidence'
  | 'research'
  | 'scraping'
  | 'quality'
  | 'opportunities'
  | 'csv';

export interface PageDef {
  id: PageId;
  label: string;
  icon: string;
  summary: string;
  when: string;
  needsHost: boolean;
}

export const PAGES: PageDef[] = [
  {
    id: 'reddit',
    label: 'Reddit Scraper',
    icon: '◉',
    summary: 'Pick subreddits and a date range, fetch top posts, filter and rank them, read comments and run a pain-point scan.',
    when: 'Start here if you just want to scrape Reddit.',
    needsHost: false,
  },
  {
    id: 'evidence',
    label: 'Evidence Library',
    icon: '▤',
    summary: 'Paste complaints, reviews or interview notes from any source, then run a deterministic pain analysis across them.',
    when: 'You already have text from forums, reviews or interviews.',
    needsHost: false,
  },
  {
    id: 'research',
    label: 'Research Queue',
    icon: '⚑',
    summary: 'Queue a research question and let Claude Code / Codex claim it, browse the web, annotate evidence and synthesize opportunities.',
    when: 'You want automated multi-source research.',
    needsHost: true,
  },
  {
    id: 'scraping',
    label: 'Web Scraping Plan',
    icon: '⌖',
    summary: 'See the URL frontier, scrape sessions, extraction quality and when scraping stops for low yield.',
    when: 'You want to monitor what the research host is scraping.',
    needsHost: true,
  },
  {
    id: 'quality',
    label: 'Quality & Market',
    icon: '✓',
    summary: 'Challenge consensus, track lineage and entities, rescore opportunities and record sourced market sizing.',
    when: 'You want to check how trustworthy the findings are.',
    needsHost: true,
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    icon: '★',
    summary: 'Define ICP and strategy, record real validation experiments, apply decision gates and prepare build / GTM plans.',
    when: 'You found an opportunity and want to decide what to do with it.',
    needsHost: false,
  },
  {
    id: 'csv',
    label: 'CSV Viewer',
    icon: '▦',
    summary: 'Preview an exported CSV in the browser. Nothing is saved to the database.',
    when: 'You want to quickly look at a spreadsheet export.',
    needsHost: false,
  },
];
