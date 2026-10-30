import type { ContextSnapshot } from '@context-atlas/model';
import { edge, node, source } from './helpers.js';

export const apiProject: ContextSnapshot = {
  schemaVersion: '1.0',
  project: {
    id: 'atlas-commerce',
    name: 'Atlas Commerce API',
    kind: 'api',
    version: 'demo-v1',
    description:
      'A synthetic order service. Trace a purchase from its consumer through validation, persistence, and a declared API response.',
    capabilities: ['overview', 'journey', 'architecture', 'api', 'data', 'work', 'study'],
    tags: ['Synthetic example', 'REST API', 'Orders', 'PostgreSQL'],
  },
  sources: [
    source('commerce-journey', 'docs/journeys/place-order.md', 'journey specification'),
    source('commerce-api', 'contracts/openapi.json', 'OpenAPI contract'),
    source('commerce-service', 'src/orders/OrderService.ts', 'service implementation'),
    source('commerce-schema', 'migrations/001_orders.sql', 'database migration'),
    source('commerce-tests', 'test/orders/create-order.test.ts', 'contract tests'),
    source('commerce-work', 'docs/work/order-reliability.md', 'work records'),
    source('commerce-study', 'docs/study/order-failure-scenarios.md', 'learning notes', 'stale'),
  ],
  nodes: [
    node({
      id: 'orders-module',
      kind: 'module',
      label: 'Orders',
      description: 'Order submission, validation, persistence, and response contracts.',
      tags: ['Core module'],
    }),
    node({
      id: 'catalog-module',
      kind: 'module',
      label: 'Catalog',
      description: 'Product availability used while validating an order.',
      tags: ['Supporting module'],
    }),
    node({
      id: 'order-consumer',
      kind: 'actor',
      label: 'API consumer',
      description:
        'An authenticated application submits an order. This API-only project has no frontend pages.',
      moduleId: 'orders-module',
      tags: ['Actor'],
    }),
    node({
      id: 'place-order-journey',
      kind: 'journey',
      label: 'Place an order',
      description:
        'Validate a submitted basket, persist the order, and return its identifier. Invalid stock is rejected before a write.',
      moduleId: 'orders-module',
      tags: ['Happy path', 'Failure path'],
    }),
    node({
      id: 'create-order',
      kind: 'operation',
      label: 'Create an order',
      moduleId: 'orders-module',
      sourceIds: ['commerce-api'],
      status: 'verified',
      tags: ['POST', '/api/orders'],
      description:
        'Accepts a customer reference and line items. Returns a created order or a declared validation error. The synthetic test evidence covers the contract, not deployment or UAT.',
      details: {
        endpoint: {
          method: 'POST',
          path: '/api/orders',
          authentication: 'Bearer token · orders:create',
          request: {
            contentType: 'application/json',
            schema: {
              type: 'object',
              required: ['customerId', 'items'],
              properties: {
                customerId: { type: 'string' },
                items: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['productId', 'quantity'],
                    properties: {
                      productId: { type: 'string' },
                      quantity: { type: 'integer', minimum: 1 },
                    },
                  },
                },
              },
            },
            example: {
              customerId: 'customer-demo-01',
              items: [{ productId: 'product-demo-01', quantity: 2 }],
            },
          },
          responses: {
            '201': {
              description: 'Order created',
              schema: {
                type: 'object',
                required: ['id', 'status'],
                properties: { id: { type: 'string' }, status: { const: 'created' } },
              },
              example: { id: 'order-demo-01', status: 'created' },
            },
            '400': {
              description: 'Invalid or empty basket',
              example: {
                code: 'INVALID_ORDER',
                message: 'At least one valid line item is required.',
              },
            },
            '401': { description: 'Authentication required', example: { code: 'UNAUTHENTICATED' } },
            '409': {
              description: 'Insufficient stock',
              example: { code: 'INSUFFICIENT_STOCK', productId: 'product-demo-01' },
            },
          },
        },
        notes: [
          'All identifiers and examples are synthetic.',
          'A verified contract test is not business acceptance or proof of a deployed service.',
        ],
      },
    }),
    node({
      id: 'validate-order',
      kind: 'service',
      label: 'Validate basket',
      description:
        'Checks nonempty line items, positive quantities, and current product availability before persisting anything.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-service'],
      status: 'verified',
      tags: ['Validation'],
      details: {
        notes: [
          'Reject invalid requests before a database write.',
          'The check and reservation must share a consistent transaction boundary.',
        ],
      },
    }),
    node({
      id: 'order-service',
      kind: 'service',
      label: 'OrderService',
      description:
        'Coordinates validation and order creation within a transaction, then maps the persisted record to the public response.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-service'],
      tags: ['Application service'],
      details: {
        code: 'async function createOrder(input, actor) {\n  const basket = await validateBasket(input.items);\n  return transaction(async () => {\n    const order = await orders.insert(actor.customerId, basket);\n    return { id: order.id, status: "created" };\n  });\n}',
        notes: ['Illustrative pseudocode for this synthetic project.'],
      },
    }),
    node({
      id: 'orders-table',
      kind: 'table',
      label: 'orders',
      description:
        'Persists the order header. A separate order_items table preserves the submitted quantities.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-schema'],
      tags: ['PostgreSQL'],
      details: {
        fields: [
          { name: 'id', type: 'uuid', required: true, primaryKey: true },
          { name: 'customer_id', type: 'uuid', required: true },
          { name: 'status', type: 'varchar(24)', required: true },
          { name: 'created_at', type: 'timestamptz', required: true },
        ],
        notes: ['Database shape is independent of the public response DTO.'],
      },
    }),
    node({
      id: 'order-items-table',
      kind: 'table',
      label: 'order_items',
      description: 'Links an order to products and retains the requested quantity.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-schema'],
      tags: ['PostgreSQL'],
      details: {
        fields: [
          { name: 'id', type: 'uuid', required: true, primaryKey: true },
          { name: 'order_id', type: 'uuid', required: true, references: 'orders.id' },
          { name: 'product_id', type: 'uuid', required: true, references: 'products.id' },
          { name: 'quantity', type: 'integer', required: true },
        ],
      },
    }),
    node({
      id: 'created-response',
      kind: 'entity',
      label: 'OrderCreated response',
      description:
        'The public response deliberately exposes only an order identifier and lifecycle status.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-api'],
      status: 'verified',
      tags: ['201 Created'],
      details: {
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'status', type: '"created"', required: true },
        ],
      },
    }),
    node({
      id: 'stock-conflict',
      kind: 'entity',
      label: 'Insufficient stock',
      description:
        'Returns HTTP 409 with a stable error code. No order is committed when availability is insufficient.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-api', 'commerce-tests'],
      status: 'verified',
      tags: ['409 Conflict', 'Failure path'],
      details: { code: '{\n  "code": "INSUFFICIENT_STOCK",\n  "productId": "product-demo-01"\n}' },
    }),
    node({
      id: 'catalog-lookup',
      kind: 'service',
      label: 'Check availability',
      description:
        'Loads product availability for validation. The concurrent reservation improvement remains a separate open task.',
      moduleId: 'catalog-module',
      sourceIds: ['commerce-service'],
      tags: ['Dependency'],
    }),
    node({
      id: 'products-table',
      kind: 'table',
      label: 'products',
      description:
        'Synthetic product identifiers and available stock. Product schema does not imply an inventory accounting implementation.',
      moduleId: 'catalog-module',
      sourceIds: ['commerce-schema'],
      tags: ['PostgreSQL'],
      details: {
        fields: [
          { name: 'id', type: 'uuid', required: true, primaryKey: true },
          { name: 'name', type: 'varchar(160)', required: true },
          { name: 'available_quantity', type: 'integer', required: true },
        ],
      },
    }),
    node({
      id: 'list-products',
      kind: 'operation',
      label: 'List products',
      description: 'Provides a cursor-paginated catalog for API consumers.',
      moduleId: 'catalog-module',
      sourceIds: ['commerce-api'],
      tags: ['GET', '/api/products'],
      details: {
        endpoint: {
          method: 'GET',
          path: '/api/products',
          authentication: 'Bearer token · catalog:read',
          parameters: [
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
          ],
          responses: {
            '200': {
              description: 'A page of products',
              example: {
                items: [{ id: 'product-demo-01', name: 'Example notebook' }],
                nextCursor: null,
              },
            },
            '401': { description: 'Authentication required' },
          },
        },
      },
    }),
    node({
      id: 'order-contract-test',
      kind: 'test',
      label: 'Create-order contract tests',
      description:
        'Synthetic test evidence covers HTTP 201, invalid basket, and insufficient stock. Deployment and user acceptance are outside this evidence.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-tests'],
      status: 'verified',
      tags: ['Contract evidence'],
      details: {
        notes: [
          'Creates a valid order: documented pass.',
          'Empty basket: documented pass.',
          'Insufficient stock returns 409 and writes no order: documented pass.',
          'This is example evidence, not a test result produced by Context Atlas.',
        ],
      },
    }),
    node({
      id: 'reservation-task',
      kind: 'task',
      label: 'Verify concurrent reservations',
      description:
        'Prove that two concurrent purchases cannot reserve the same remaining unit. Blocked on an agreed reservation contract.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-work'],
      status: 'proposed',
      tags: ['Reliability', 'Blocker'],
      details: {
        task: { state: 'blocked', priority: 'high' },
        notes: [
          'Next: agree the reservation transaction boundary, then add a concurrency test.',
          'Ownership and task mutations remain with the host project.',
        ],
      },
    }),
    node({
      id: 'transaction-decision',
      kind: 'decision',
      label: 'One order transaction',
      description:
        'An agreed synthetic design decision keeps order header and line-item writes atomic. This does not prove the concurrency requirement is satisfied.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-journey'],
      status: 'accepted',
      tags: ['Architecture decision'],
    }),
    node({
      id: 'failure-study',
      kind: 'topic',
      label: 'Study: failed order submission',
      description:
        'A hypothetical learning exercise asks what happens when stock changes during checkout. It is not an approved runtime contract or UAT result.',
      moduleId: 'orders-module',
      sourceIds: ['commerce-study'],
      status: 'proposed',
      evidence: 'inferred',
      tags: ['Hypothetical', 'Needs review'],
      details: {
        notes: [
          'Start with the 201 path, then locate the 409 branch.',
          'Question: which writes must roll back after a failed reservation?',
          'Question: which evidence would prove correctness under concurrency?',
          'These notes are stale relative to demo-v1 and require an owner review.',
        ],
      },
    }),
    node({
      id: 'api-contract-document',
      kind: 'document',
      label: 'OpenAPI contract',
      description:
        'The declared method, request, response, authentication, and error shapes for this synthetic API.',
      sourceIds: ['commerce-api'],
      tags: ['Source of truth'],
    }),
  ],
  edges: [
    edge('orders-module', 'place-order-journey', 'contains'),
    edge('orders-module', 'create-order', 'contains'),
    edge('catalog-module', 'list-products', 'contains'),
    edge('order-consumer', 'create-order', 'calls', 'commerce-journey', 'Submit basket'),
    edge('create-order', 'validate-order', 'calls', 'commerce-service', 'Validate input'),
    edge('validate-order', 'order-service', 'next', 'commerce-service', 'Valid basket'),
    edge('validate-order', 'stock-conflict', 'rejects', 'commerce-tests', 'Insufficient stock'),
    edge('validate-order', 'catalog-lookup', 'calls', 'commerce-service'),
    edge('catalog-lookup', 'products-table', 'reads', 'commerce-service'),
    edge('order-service', 'orders-table', 'writes', 'commerce-service', 'Atomic write'),
    edge('order-service', 'order-items-table', 'writes', 'commerce-service'),
    edge('orders-table', 'created-response', 'returns', 'commerce-api', '201 Created'),
    edge('order-items-table', 'orders-table', 'references', 'commerce-schema', 'order_id'),
    edge('order-items-table', 'products-table', 'references', 'commerce-schema', 'product_id'),
    edge('list-products', 'products-table', 'reads', 'commerce-service'),
    edge('order-contract-test', 'create-order', 'tests', 'commerce-tests'),
    edge('order-contract-test', 'stock-conflict', 'tests', 'commerce-tests'),
    edge('reservation-task', 'catalog-lookup', 'blocks', 'commerce-work'),
    edge('transaction-decision', 'order-service', 'documents'),
    edge('failure-study', 'stock-conflict', 'documents', 'commerce-study'),
    edge('api-contract-document', 'create-order', 'documents', 'commerce-api'),
  ],
  views: [
    {
      id: 'overview',
      kind: 'overview',
      label: 'Project overview',
      description: 'Understand the scope, two modules, and the sources behind this synthetic API.',
      nodeIds: [
        'orders-module',
        'catalog-module',
        'place-order-journey',
        'create-order',
        'list-products',
        'orders-table',
        'products-table',
        'reservation-task',
      ],
    },
    {
      id: 'place-order',
      kind: 'journey',
      label: 'Place an order',
      description:
        'Follow the normal path from an authenticated consumer to a created order, with a visible stock-conflict branch.',
      nodeIds: [
        'order-consumer',
        'create-order',
        'validate-order',
        'order-service',
        'orders-table',
        'created-response',
        'stock-conflict',
      ],
      steps: [
        {
          nodeId: 'order-consumer',
          label: 'Submit a basket',
          description: 'The API consumer supplies customer and line-item references.',
        },
        {
          nodeId: 'create-order',
          label: 'Accept the request',
          description: 'Validate the declared authentication and payload contract.',
        },
        {
          nodeId: 'validate-order',
          label: 'Check the basket',
          description: 'Reject invalid quantities or insufficient availability.',
        },
        {
          nodeId: 'order-service',
          label: 'Create the order',
          description: 'Coordinate the transaction and public response mapping.',
        },
        {
          nodeId: 'orders-table',
          label: 'Persist the record',
          description: 'Write the order header and related line items atomically.',
        },
        {
          nodeId: 'created-response',
          label: 'Return the identifier',
          description: 'HTTP 201 exposes the new identifier and status.',
        },
      ],
    },
    {
      id: 'architecture',
      kind: 'architecture',
      label: 'Service architecture',
      description:
        'Inspect the order service and catalog dependency without inventing frontend pages.',
      nodeIds: [
        'create-order',
        'validate-order',
        'order-service',
        'catalog-lookup',
        'orders-table',
        'order-items-table',
        'products-table',
        'list-products',
      ],
    },
    {
      id: 'api',
      kind: 'api',
      label: 'API reference',
      description:
        'Inspect declared request schemas, parameters, authentication, success responses, and error variants.',
      nodeIds: ['create-order', 'list-products', 'created-response', 'stock-conflict'],
    },
    {
      id: 'data',
      kind: 'data',
      label: 'Data model',
      description:
        'Explore synthetic table fields, primary keys, and explicit foreign-key relationships.',
      nodeIds: ['orders-table', 'order-items-table', 'products-table'],
    },
    {
      id: 'work',
      kind: 'work',
      label: 'Work and evidence',
      description:
        'Distinguish an accepted design decision, example test evidence, and a blocked reliability task.',
      nodeIds: [
        'reservation-task',
        'transaction-decision',
        'order-contract-test',
        'catalog-lookup',
        'create-order',
      ],
    },
    {
      id: 'study',
      kind: 'study',
      label: 'Learning path',
      description:
        'A guided hypothetical failure exercise linked to the actual declared error contract. Study notes need review.',
      nodeIds: [
        'failure-study',
        'place-order-journey',
        'create-order',
        'stock-conflict',
        'order-contract-test',
      ],
    },
  ],
};
