# Security Policy

## Supported versions

Security fixes are released for the latest version only.

| Version | Supported |
| --- | --- |
| Latest 0.5.x | Yes |
| Older | No |

## Verifying a release

Releases from 0.5.4 on are published by the `Publish` GitHub Actions workflow with [npm provenance](https://docs.npmjs.com/generating-provenance-statements). The npm package page shows the source commit and the workflow run that built each version. To check the signatures and provenance of what you installed:

```bash
npm audit signatures
```

Versions up to 0.5.3 were published from a local machine and have no provenance.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through [GitHub private vulnerability reporting](https://github.com/darshanraj046/logql-query-box/security/advisories/new). Include the version, the query or input that triggers the problem, and what happens.

You will get a reply as soon as possible. Once the problem is confirmed, the fix is released as a new version and described in a security advisory.

## What to report

- A value that breaks out of its quoted string in the compiled LogQL.
- Input that crashes the page or freezes the browser.
- Anything in the component that runs untrusted text as HTML or code.

## Using this package safely

This package builds queries in the browser, and anyone can change what a browser sends. Treat LogQL that comes from a browser as untrusted, and enforce tenant and access limits on your server.
