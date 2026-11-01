# Security Policy

## Supported versions

Security fixes are released for the latest version only.

| Version | Supported |
| --- | --- |
| Latest 0.3.x | Yes |
| Older | No |

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
