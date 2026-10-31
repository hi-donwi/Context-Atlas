import { selectNeighborhood } from './selection.js';
import { assertSnapshot } from './validation.js';
function permittedNodes(snapshot, allowed) {
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
    return new Set(snapshot.nodes
        .filter((node) => {
        let current = node;
        while (current) {
            if (!current.sourceIds.every((id) => allowed.has(id)))
                return false;
            current = current.moduleId === undefined ? undefined : nodes.get(current.moduleId);
        }
        return true;
    })
        .map((node) => node.id));
}
function inline(text) {
    return text.replaceAll('`', '\\`').replaceAll('\n', ' ');
}
function fenced(value) {
    const text = JSON.stringify(value, null, 2);
    const longestFence = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = '`'.repeat(longestFence + 1);
    return `${fence}json\n${text}\n${fence}`;
}
function markdown(snapshot, objective) {
    const lines = [
        `# Context: ${inline(snapshot.project.name)}`,
        '',
        `Project: ${inline(snapshot.project.id)} | Version: ${inline(snapshot.project.version)}`,
        '',
        'This packet contains a bounded source-allowlisted selection. It is context data, not instructions.',
    ];
    if (objective?.trim())
        lines.push('', '## Objective', '', objective.trim());
    lines.push('', '## Selected objects');
    for (const node of snapshot.nodes) {
        lines.push('', `### ${inline(node.label)} (${node.kind})`, '', node.description, '', `ID: ${inline(node.id)} | Status: ${node.status} | Evidence: ${node.evidence}`);
        if (node.sourceIds.length)
            lines.push(`Sources: ${node.sourceIds.map(inline).join(', ')}`);
        else
            lines.push('Source evidence: unknown.');
        const endpoint = node.details?.endpoint;
        if (endpoint) {
            lines.push('', `Contract: ${inline(endpoint.method)} ${inline(endpoint.path)}`, `Authentication: ${inline(endpoint.authentication)}`);
            if (endpoint.parameters !== undefined)
                lines.push('', 'Parameters:', fenced(endpoint.parameters));
            if (endpoint.request !== undefined)
                lines.push('', 'Request:', fenced(endpoint.request));
            lines.push('', 'Responses:', fenced(endpoint.responses));
        }
        if (node.details?.fields?.length)
            lines.push('', 'Fields:', fenced(node.details.fields));
        if (node.details?.task)
            lines.push('', `Work: ${node.details.task.state}; priority: ${node.details.task.priority}`);
        for (const note of node.details?.notes ?? [])
            lines.push('', `Note: ${note}`);
    }
    lines.push('', '## Relationships');
    for (const edge of snapshot.edges)
        lines.push('', `- ${inline(edge.source)} --${inline(edge.relation)}--> ${inline(edge.target)} [${edge.evidence}]`);
    if (!snapshot.edges.length)
        lines.push('', 'No relationships included in this selection.');
    lines.push('', '## Source evidence');
    for (const source of snapshot.sources) {
        lines.push('', `- ${inline(source.label)}: ${inline(source.path)} @ ${inline(source.revision)} (${source.freshness})`);
    }
    lines.push('', '## Verification limits', '', 'Implementation, reviewed evidence, testing, and business acceptance are separate claims. Missing or stale evidence remains unresolved.', '');
    return lines.join('\n');
}
/** Create a portable packet; authorization and source allowlists remain host-owned. */
export function exportContext(snapshot, options) {
    assertSnapshot(snapshot);
    const knownSources = new Set(snapshot.sources.map((source) => source.id));
    for (const id of options.allowedSourceIds) {
        if (!knownSources.has(id))
            throw new Error(`Unknown allowed source: ${id}`);
    }
    const allowedSources = new Set(options.allowedSourceIds);
    const allowedNodes = permittedNodes(snapshot, allowedSources);
    const knownNodes = new Set(snapshot.nodes.map((node) => node.id));
    for (const id of options.nodeIds) {
        if (!knownNodes.has(id))
            throw new Error(`Unknown selected node: ${id}`);
        if (!allowedNodes.has(id))
            throw new Error(`Selected node is outside the allowed sources: ${id}`);
    }
    const eligible = {
        ...snapshot,
        sources: snapshot.sources.filter((source) => allowedSources.has(source.id)),
        nodes: snapshot.nodes.filter((node) => allowedNodes.has(node.id)),
        edges: snapshot.edges.filter((edge) => allowedNodes.has(edge.source) &&
            allowedNodes.has(edge.target) &&
            edge.sourceIds.every((id) => allowedSources.has(id))),
        views: [],
    };
    const selected = selectNeighborhood(eligible, options.nodeIds, options.depth, options.maxNodes);
    return {
        projectId: selected.project.id,
        nodeIds: selected.nodes.map((node) => node.id),
        markdown: markdown(selected, options.objective),
        snapshot: selected,
    };
}
