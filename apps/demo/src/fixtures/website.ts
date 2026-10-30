import type { ContextSnapshot } from '@context-atlas/model';
import { edge, node, source } from './helpers.js';

const websiteNode = (input: Parameters<typeof node>[0]) =>
  node({ sourceIds: ['website-journey'], ...input });
const websiteEdge = (from: string, to: string, relation: string, label?: string) =>
  edge(from, to, relation, 'website-journey', label);

export const websiteProject: ContextSnapshot = {
  schemaVersion: '1.0',
  project: {
    id: 'fieldnotes-website',
    name: 'Fieldnotes Website',
    kind: 'website',
    version: 'demo-v1',
    description:
      'A synthetic editorial website. Connect a reader journey to its page, form, API contract, service, and stored subscription.',
    capabilities: ['overview', 'journey', 'architecture', 'api', 'data', 'work', 'study'],
    tags: ['Synthetic example', 'Website', 'Newsletter'],
  },
  sources: [
    source('website-journey', 'docs/journeys/subscribe.md', 'website journey'),
    source('website-page', 'src/pages/JournalPage.tsx', 'page implementation'),
    source('website-api', 'contracts/newsletter.openapi.json', 'newsletter contract'),
    source('website-schema', 'migrations/001_subscriptions.sql', 'subscription schema'),
    source('website-work', 'docs/work/newsletter.md', 'newsletter task'),
  ],
  nodes: [
    websiteNode({
      id: 'newsletter-module',
      kind: 'module',
      label: 'Newsletter',
      description: 'Reader signup, confirmation, and subscription records.',
    }),
    websiteNode({
      id: 'site-reader',
      kind: 'actor',
      label: 'Reader',
      description: 'A visitor who chooses to receive future journal updates.',
      moduleId: 'newsletter-module',
    }),
    websiteNode({
      id: 'journal-page',
      kind: 'page',
      label: 'Journal page',
      description: 'Presents editorial content and an accessible email subscription form.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-page'],
      status: 'verified',
      tags: ['Frontend', '/journal'],
      details: {
        notes: [
          'Input has an accessible label and announced validation errors.',
          'A pending state prevents duplicate submissions.',
        ],
      },
    }),
    websiteNode({
      id: 'subscribe-journey',
      kind: 'journey',
      label: 'Subscribe to updates',
      description:
        'A reader enters an email, the server accepts the signup, and the page announces the next step.',
      moduleId: 'newsletter-module',
    }),
    websiteNode({
      id: 'subscribe-api',
      kind: 'operation',
      label: 'Subscribe to newsletter',
      description:
        'A public endpoint validates the email and records a pending subscription. Examples use reserved example.invalid addresses.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-api'],
      tags: ['POST', '/api/subscriptions'],
      details: {
        endpoint: {
          method: 'POST',
          path: '/api/subscriptions',
          authentication: 'Public · rate limited by host',
          request: {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
            example: { email: 'reader@example.invalid' },
          },
          responses: {
            '202': { description: 'Signup accepted', example: { status: 'pending-confirmation' } },
            '400': { description: 'Invalid email', example: { code: 'INVALID_EMAIL' } },
            '429': { description: 'Too many requests' },
          },
        },
      },
    }),
    websiteNode({
      id: 'subscription-service',
      kind: 'service',
      label: 'SubscriptionService',
      description: 'Validates the email, applies duplicate policy, and creates a pending record.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-api'],
      tags: ['Backend'],
    }),
    websiteNode({
      id: 'subscriptions-table',
      kind: 'table',
      label: 'subscriptions',
      description:
        'Stores the normalized email and confirmation lifecycle. No real subscriber data is included.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-schema'],
      details: {
        fields: [
          { name: 'id', type: 'uuid', primaryKey: true, required: true },
          { name: 'email', type: 'varchar(254)', required: true },
          { name: 'status', type: 'varchar(32)', required: true },
          { name: 'created_at', type: 'timestamptz', required: true },
        ],
      },
    }),
    websiteNode({
      id: 'confirmation-state',
      kind: 'page',
      label: 'Check your inbox',
      description:
        'An announced success state explains that the reader still needs to confirm their email.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-page'],
      tags: ['Visible state'],
    }),
    websiteNode({
      id: 'invalid-email',
      kind: 'entity',
      label: 'Invalid email response',
      description: 'HTTP 400 keeps the entered value and asks the reader to correct the address.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-api'],
      tags: ['Error path'],
      details: { code: '{ "code": "INVALID_EMAIL" }' },
    }),
    websiteNode({
      id: 'confirmation-task',
      kind: 'task',
      label: 'Verify confirmation delivery',
      description:
        'Add test evidence for delayed or failed confirmation delivery before declaring the journey accepted.',
      moduleId: 'newsletter-module',
      sourceIds: ['website-work'],
      status: 'proposed',
      details: { task: { state: 'todo', priority: 'medium' } },
    }),
    websiteNode({
      id: 'website-study',
      kind: 'topic',
      label: 'Study: a recoverable form',
      description:
        'A hypothetical exercise follows invalid, pending, accepted, and retry states. It does not claim those behaviors were tested by Context Atlas.',
      moduleId: 'newsletter-module',
      status: 'proposed',
      tags: ['Hypothetical'],
      details: {
        notes: [
          'Trace the response code back to the visible page state.',
          'Which entered values survive a failed submission?',
          'How would a keyboard user notice the result?',
        ],
      },
    }),
  ],
  edges: [
    websiteEdge('newsletter-module', 'subscribe-journey', 'contains'),
    websiteEdge('site-reader', 'journal-page', 'visits'),
    websiteEdge('journal-page', 'subscribe-api', 'calls', 'Submit email'),
    websiteEdge('subscribe-api', 'subscription-service', 'calls'),
    websiteEdge('subscription-service', 'subscriptions-table', 'writes'),
    websiteEdge('subscriptions-table', 'confirmation-state', 'next', '202 Accepted'),
    websiteEdge('subscribe-api', 'invalid-email', 'rejects', '400 Invalid email'),
    websiteEdge('confirmation-task', 'confirmation-state', 'documents'),
    websiteEdge('website-study', 'subscribe-journey', 'documents'),
  ],
  views: [
    {
      id: 'overview',
      kind: 'overview',
      label: 'Project overview',
      description: 'A website journey that spans frontend, backend, and data.',
      nodeIds: [
        'newsletter-module',
        'journal-page',
        'subscribe-api',
        'subscriptions-table',
        'confirmation-task',
      ],
    },
    {
      id: 'subscribe',
      kind: 'journey',
      label: 'Subscribe to updates',
      description: 'Follow a reader signup from page input to the visible confirmation state.',
      nodeIds: [
        'site-reader',
        'journal-page',
        'subscribe-api',
        'subscription-service',
        'subscriptions-table',
        'confirmation-state',
        'invalid-email',
      ],
      steps: [
        { nodeId: 'site-reader', label: 'Choose to subscribe' },
        { nodeId: 'journal-page', label: 'Enter an email' },
        { nodeId: 'subscribe-api', label: 'Submit the form' },
        { nodeId: 'subscription-service', label: 'Validate the signup' },
        { nodeId: 'subscriptions-table', label: 'Save a pending record' },
        { nodeId: 'confirmation-state', label: 'Explain the next step' },
      ],
    },
    {
      id: 'architecture',
      kind: 'architecture',
      label: 'Page to service',
      description: 'Understand the page, API, backend service, and persistence boundary.',
      nodeIds: [
        'journal-page',
        'subscribe-api',
        'subscription-service',
        'subscriptions-table',
        'confirmation-state',
      ],
    },
    {
      id: 'api',
      kind: 'api',
      label: 'API reference',
      description: 'Inspect the signup input and declared success/error responses.',
      nodeIds: ['subscribe-api', 'invalid-email'],
    },
    {
      id: 'data',
      kind: 'data',
      label: 'Data model',
      description: 'Inspect the synthetic subscription schema.',
      nodeIds: ['subscriptions-table'],
    },
    {
      id: 'work',
      kind: 'work',
      label: 'Work to verify',
      description: 'The remaining verification task prevents premature acceptance.',
      nodeIds: ['confirmation-task', 'confirmation-state'],
    },
    {
      id: 'study',
      kind: 'study',
      label: 'Learning path',
      description: 'Learn to map request outcomes back to recoverable interface states.',
      nodeIds: [
        'website-study',
        'journal-page',
        'subscribe-api',
        'invalid-email',
        'confirmation-state',
      ],
    },
  ],
};
