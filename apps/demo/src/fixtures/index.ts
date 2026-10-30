import type { ContextSnapshot } from '@context-atlas/model';
import { apiProject } from './api.js';
import { websiteProject } from './website.js';

export { apiProject, websiteProject };
export const demoProjects: ContextSnapshot[] = [apiProject, websiteProject];
