# Publishing checklist

This package is prepared for publication as:

```text
@scorpio-jrb/node-red-contrib-scorp-io
```

## Sources

- Node-RED packaging requirements: https://nodered.org/docs/creating-nodes/packaging
- Node-RED Flow Library node submission: https://flows.nodered.org/add/node
- Node-RED palette installation behavior: https://nodered.org/docs/user-guide/runtime/adding-nodes

## Pre-flight

Run from the repository root:

```bash
npm install
npm test
npm audit --omit=dev
npm run pack:dry-run
npm publish --dry-run
```

Expected validated state on 2026-06-15:

```text
npm test                 -> 48 passing
npm audit --omit=dev     -> found 0 vulnerabilities
npm publish --dry-run    -> package accepted for dry-run, npm login still required for real publish
```

## npm publication

Prerequisites:

1. The npm scope `@scorp-io` must exist as a user or organisation scope.
2. The publisher must be logged in and allowed to publish under `@scorp-io`.
3. The package name must remain available on npm.

Commands:

```bash
npm login
npm whoami
npm publish
```

Verify after publication:

```bash
npm view @scorpio-jrb/node-red-contrib-scorp-io name version
```

## Node-RED Flow Library submission

After the npm package is public:

1. Go to https://flows.nodered.org/add/node
2. Sign in with GitHub.
3. Submit:

```text
@scorpio-jrb/node-red-contrib-scorp-io
```

Node-RED states that the Flow Library no longer auto-indexes npm packages; manual submission is required.

## End-user installation check

After Flow Library indexing, users should be able to install from:

```text
Node-RED -> Menu -> Manage palette -> Install
```

Search for:

```text
@scorpio-jrb/node-red-contrib-scorp-io
```

CLI equivalent:

```bash
cd ~/.node-red
npm install @scorpio-jrb/node-red-contrib-scorp-io
```

Restart Node-RED after installation.
