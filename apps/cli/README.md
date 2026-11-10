# `context-atlas-cli`

Read-only local explorer for Context Atlas project folders. The `context-atlas` command
serves the selected folder on the loopback interface and includes the browser UI.

Requires Node.js 22.12 or later.

## Run against the current directory

From the root of a project or context repository:

```sh
npm exec --yes --package=context-atlas-cli@0.1.0 -- context-atlas . --port 4317
```

To make the command available as a project script, add this entry to that directory's
`package.json`:

```json
{
  "private": true,
  "scripts": {
    "atlas": "npm exec --yes --package=context-atlas-cli@0.1.0 -- context-atlas . --port 4317"
  }
}
```

Then run `npm run atlas`. The CLI resolves `.` from the directory where the command was
invoked. The server is read-only and binds to `127.0.0.1`.

## Run against another folder

```sh
npm exec --yes --package=context-atlas-cli@0.1.0 -- context-atlas /path/to/project-docs --port 4317
```

The optional `--project <key>` argument locks a workspace context to one registered
project. See the main repository README for the local development workflow and package
architecture.
