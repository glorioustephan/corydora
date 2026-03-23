import type { AgentDefinition } from '../types/domain.js';

export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: 'bug-investigator',
    label: 'Bug Investigator',
    description: 'Find correctness bugs and concrete failure paths in one file at a time.',
    categories: ['bugs'],
    techLenses: ['typescript', 'refactoring'],
    prompt:
      'Focus on concrete bugs, edge-case failures, and misleading behavior. Prefer narrow fixes and testable evidence.',
    source: 'builtin',
  },
  {
    id: 'performance-engineer',
    label: 'Performance Engineer',
    description: 'Find unnecessary renders, repeated work, and heavy I/O hot spots.',
    categories: ['performance'],
    techLenses: ['typescript', 'react', 'nextjs', 'electron'],
    prompt:
      'Look for measurable performance improvements. Prefer small changes with clear user-facing impact.',
    source: 'builtin',
  },
  {
    id: 'test-hardener',
    label: 'Test Hardener',
    description: 'Identify missing tests, flaky patterns, and weak validation.',
    categories: ['tests'],
    techLenses: ['typescript', 'react', 'nextjs', 'node-cli'],
    prompt:
      'Focus on observable behavior and missing safety nets. Recommend the narrowest test or validation addition.',
    source: 'builtin',
  },
  {
    id: 'todo-triager',
    label: 'Todo Triager',
    description: 'Turns comments, skipped code paths, and deferred work into concrete tasks.',
    categories: ['todo'],
    techLenses: ['typescript', 'refactoring'],
    prompt: 'Convert vague technical debt into actionable, scoped tasks. Avoid broad rewrites.',
    source: 'builtin',
  },
  {
    id: 'feature-scout',
    label: 'Feature Scout',
    description: 'Identifies small feature opportunities that fit the existing architecture.',
    categories: ['features'],
    techLenses: ['react', 'nextjs', 'node-cli', 'electron'],
    prompt:
      'Propose only incremental product improvements. Features are queued by default and not auto-fixed unless enabled.',
    source: 'builtin',
  },
  {
    id: 'security-auditor',
    label: 'Security Auditor',
    description: 'Looks for frontend and backend security issues with concrete exploit paths.',
    categories: ['bugs'],
    techLenses: ['security', 'typescript', 'react', 'nextjs', 'node-cli'],
    prompt:
      'Prioritize trust boundaries, unsafe input handling, auth assumptions, and exploitable patterns.',
    source: 'builtin',
  },
  {
    id: 'database-reviewer',
    label: 'Database Reviewer',
    description:
      'Finds risky queries, schema drift issues, and performance bottlenecks around data access.',
    categories: ['bugs', 'performance'],
    techLenses: ['database', 'typescript', 'node-cli'],
    prompt: 'Focus on concrete query risks, indexing concerns, and data-layer correctness.',
    source: 'builtin',
  },
  {
    id: 'refactoring-engineer',
    label: 'Refactoring Engineer',
    description: 'Finds low-risk structural cleanups that make future work easier.',
    categories: ['todo', 'performance', 'tests'],
    techLenses: ['refactoring', 'typescript'],
    prompt:
      'Prefer low-risk structure improvements that reduce complexity without changing behavior.',
    source: 'builtin',
  },
];
