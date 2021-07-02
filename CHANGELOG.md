# Changelog

## 1.8.0 2021-07-02
* Specify `ssl_prefer_server_ciphers on`, which results in more secure cipher choices being chosen first and an "A" rating from SLL Labs without micromanagement of cipher settings.
* Bug fix: ensure `site.backends` exists so a simple static site doesn't crash template generation. This bug was introduced in version 1.7.0.

## 1.7.0
Support for path-specific backends, i.e. backends that only accept traffic for a certain path prefix. This is handy for routing traffic to microservices without subdomains.

## 1.6.1
Adds previous TLS update across template.

## 1.6.0
Adds support for TLS 1.3 and removes support for TLS 1.1, for security reasons.

## 1.5.0
Adds http/2 support for https requests by using `mechanic set http2 true`. Adds a permanent option to turn default temporary redirects (302) into permanent (301) by using `--permanent=true`. This can be undone by using `--permanent=false`.

## 1.4.0
Added the `--redirect=https://example.com` and `--redirect-full=https://example.com` options, to redirect all traffic to another site. If you want the rest of the URL after the hostname to be appended when redirecting, use `--redirect-full`. To send everything to the same place, use `--redirect`.

## 1.3.3
Corrects a typo in the `--websockets` option that had required the singular form of the word. Spaces out entries when using `mechanic list` to view current sites.

## 1.3.2
Adds JS linting, some code clean up.

## 1.3.1
document `--websockets` flag. No code changes.

## 1.3.0
optional `--websockets` flag to enable support for websockets in the app behind the proxy. Thanks to Ahmet Simsek.

## 1.2.5
documentation update indicating that `client_max_body_size` works best in the `location` override file. Thanks to Bob Clewell of P'unk Avenue for this contribution.

## 1.2.4
if `https` and `redirect-to-https` are active for the site, redirect straight to https when canonicalizing, avoid an extra http hop which was generating security scan complaints and adding a touch of latency.

## 1.2.3
depend on `prettiest` 1.1.0 or better, as a way of making it hopefully easier to install by transitively depending on a newer version of `fs-ext`.

## 1.2.2
added config for running tests on CircleCI.

## 1.2.1
fixed bug introduced in 1.2.0 with the use of `let` to redeclare a variable that is already a function argument.

## 1.2.0
`--https-upstream` option added; when present connections to backends are made via `https` rather than `http`. This is useful when the upstream servers are remote and not just next door on a secured local network. Of course, there is a performance impact. Thanks to Kevin S. (t3rminus) for this contribution.

## 1.1.0
sites set `--default=true` are always moved to the end of the list, and the end of the generated nginx configuration file. This is helpful when reading `mechanic list` and also works around an issue we've seen in at least one case where nginx did not appear to honor its usual rule that a `server_name` match should always beat `default_server`.

## 1.0.2
Canonicalization also applies to https. Of course it won't magically
work for aliases your certificate doesn't cover, but it will work for
www to bare domain or vice versa, or whatever your certificate does include.

## 1.0.1
Moved standard gzip directives to the start of the server block. Otherwise responses proxied through to node are not compressed. A large performance win.

## 1.0.0
Officially stable and following semantic versioning from here on out. Also added `top` and `server` override files and the `--index` option, and made `backends` optional when `static` is present. This allows the use of mechanic to set up very simple static websites.

## 0.1.13—0.1.14 
pass the `X-Forwarded-Proto` header for compatibility with the `secure` flag for session cookies, provided that Express is configured to trust the first proxy.

Killed support for `tlsv1` as it is insecure.

## 0.1.12
killed support for `sslv3` as it is insecure.

## 0.1.11
parse `host:port` correctly with the `--backends` option.

## 0.1.10
the `boring` dependency was missing, this is fixed.

## 0.1.9
Accept `backend` as an alias for `backends`. Reject invalid hyphenated options passed to `add` and `update`, as their absence usually means you've mistyped something important. Don't crash nginx if there are no backends, just skip that site and print a warning. Use [boring](https://www.npmjs.com/package/boring) instead of `yargs`.

## 0.1.8
load convenience overrides from suitably named nginx configuration files.

## 0.1.7
set the ssl flag properly for nginx in the listen statement.

## 0.1.6
look in the documented place for SSL certificates (/etc/nginx/certs).

## 0.1.5
don't try to reject invalid arguments, as yargs helpfully introduces camel-cased versions of hyphenated arguments, causing false positives and breaking our hyphenated options. This isn't great; we should find out how to disable that behavior in yargs.

## 0.1.3
corrected documentation for Apache fallback strategy.

## 0.1.1, 0.1.2
`reset` command works.

## 0.1.0
initial release.
