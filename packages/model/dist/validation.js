import validateGeneratedSchema from './generated-schema-validator.js';
const checkShape = validateGeneratedSchema;
function safeSourcePath(path) {
    if (/^[a-z][a-z\d+.-]*:/i.test(path) ||
        path.startsWith('/') ||
        /[\\\u0000-\u001f\u007f%]/.test(path))
        return false;
    return path
        .split('/')
        .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
/** Validate structural shape and graph references without modifying imported data. */
export function validateSnapshot(input) {
    if (!checkShape(input)) {
        return {
            success: false,
            issues: (checkShape.errors ?? []).map((error) => ({
                path: error.instancePath || '/',
                message: error.message ?? 'Invalid snapshot value',
            })),
        };
    }
    const issues = [];
    const issue = (path, message) => {
        issues.push({ path, message });
    };
    for (const collection of ['nodes', 'sources', 'edges', 'views']) {
        const seen = new Set();
        input[collection].forEach((item, index) => {
            if (seen.has(item.id))
                issue(`/${collection}/${index}/id`, `Duplicate ${collection} ID: ${item.id}`);
            seen.add(item.id);
        });
    }
    const sources = new Set(input.sources.map((source) => source.id));
    const nodes = new Map(input.nodes.map((node) => [node.id, node]));
    const checkSources = (ids, path) => {
        ids.forEach((id, index) => {
            if (!sources.has(id))
                issue(`${path}/${index}`, `Unknown source reference: ${id}`);
        });
    };
    input.sources.forEach((source, index) => {
        if (!safeSourcePath(source.path))
            issue(`/sources/${index}/path`, 'Source path must be a safe, unencoded relative path');
    });
    input.nodes.forEach((node, index) => {
        checkSources(node.sourceIds, `/nodes/${index}/sourceIds`);
        if (node.moduleId !== undefined) {
            const parent = nodes.get(node.moduleId);
            if (!parent || parent.kind !== 'module')
                issue(`/nodes/${index}/moduleId`, `Unknown module reference: ${node.moduleId}`);
            const seen = new Set([node.id]);
            let ancestor = node.moduleId;
            while (ancestor !== undefined) {
                if (seen.has(ancestor)) {
                    issue(`/nodes/${index}/moduleId`, 'Module ancestry must not contain a cycle');
                    break;
                }
                seen.add(ancestor);
                const next = nodes.get(ancestor)?.moduleId;
                if (next === undefined)
                    break;
                ancestor = next;
            }
        }
    });
    input.edges.forEach((edge, index) => {
        checkSources(edge.sourceIds, `/edges/${index}/sourceIds`);
        for (const endpoint of ['source', 'target']) {
            if (!nodes.has(edge[endpoint]))
                issue(`/edges/${index}/${endpoint}`, `Unknown node reference: ${edge[endpoint]}`);
        }
    });
    input.views.forEach((view, index) => {
        const membership = new Set(view.nodeIds);
        if (!input.project.capabilities.includes(view.kind))
            issue(`/views/${index}/kind`, `View capability is not declared: ${view.kind}`);
        view.nodeIds.forEach((id, position) => {
            if (!nodes.has(id))
                issue(`/views/${index}/nodeIds/${position}`, `Unknown node reference: ${id}`);
        });
        view.steps?.forEach((step, position) => {
            if (!nodes.has(step.nodeId) || !membership.has(step.nodeId)) {
                issue(`/views/${index}/steps/${position}/nodeId`, 'Journey step must reference a node included in the view');
            }
        });
    });
    return issues.length ? { success: false, issues } : { success: true, snapshot: input };
}
export function assertSnapshot(snapshot) {
    const result = validateSnapshot(snapshot);
    if (!result.success)
        throw new Error(`Invalid snapshot: ${result.issues[0]?.path} ${result.issues[0]?.message}`);
}
