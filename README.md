# mechanic

## Purpose

[nginx](http://nginx.org) is a popular reverse proxy server among node developers. It's common to set up one or more node apps listening on high-numbered ports and use nginx virtual hosting and reverse proxy features to pass traffic to node. nginx can also serve static files better than node can, and it has battle-testd round-robin load balancing features.

We've boiled down our favorite configuration recipes for nginx to a simple utility that takes care of spinning up and shutting down proxies for new node sites on a server. It can also handle load balancing, canonical redirects, direct delivery of static files and https configuration. It takes the place of manually editing nginx configuration files.

## Install

**Step One:** install `nginx` on your Linux server.

Under Ubuntu Linux that would be:

```
apt-get install nginx
```

Make sure Apache isn't in the way, already listening on port 80. Remove it really, really thoroughly. Or reconfigure it for an alternate port, like 9898, and set it up as a `fallback` as described below.

**Step Two:**

```
npm install -g mechanic
```

NOTE: `mechanic` will reconfigure nginx after each command given to it. A strong effort is made not to mess up other uses of nginx. Mechanic's nginx configuration output is written to `/etc/nginx/mechanic.conf` and a directive to load it is placed at the end of `nginx.conf` if it is not already present. No other nginx configuration files are touched. You can change the `nginx` configuration folder if you want to, see below.

**Step Three:**

Go nuts.

Let's add a single proxy that talks to one node process, which is listening on port 3000 on the same server (`localhost`):

*All commands must be run as root.*

```
mechanic add mysite --host=mysite.com --backends=3000
```

Replace `mysite` with a good "shortname" for *your* site— letters and numbers and underscores only, no leading digits.

`mechanic` will reconfigure and restart `nginx` as you go along and remember everything you've asked it to include.

Next we decide we want some aliases: other hostnames that deliver the same content. It's common to do this in the pre-launch period. With the `update` command we can add new options to a site without starting from scratch:

```
mechanic update mysite --aliases=www.mysite.com,mysite.temporary.com
```

In production, it's better to redirect traffic so that everyone sees the same domain. Let's start redirecting from our aliases rather than keeping them in the address bar:

```
mechanic update mysite --canonical=true
```

We've realized this site should be the default site for the entire server. If a request arrives with a hostname that doesn't match any `--host` or `--aliases` list, it should always go to this site, redirecting first if the site is canonical. We can do that with `default`:

```
mechanic update mysite --default=true
```

Let's score a big performance win by serving our static files directly with nginx. This is simple: if a file matching the URL exists, nginx will serve it directly. Otherwise the request is still sent to node. All we have to do is tell nginx where our static files live.

```
mechanic update mysite --static=/opt/stagecoach/apps/mysite/current/public
```

*Browsers will cache the static files for up to 7 days. That's a good thing, but if you use this feature make sure any dynamically generated files have new filenames on each new deployment.*

Traffic is surging, so we've set up four node processes to take advantage of four cores. They are listening on ports 3000, 3001, 3002 and 3003. Let's tell nginx to distribute traffic to all of them:

```
mechanic update mysite --backends=3000,3001,3002,3003
```

This time we want to load-balance between two separate back-end servers, each of which is listening on two ports:

```
mechanic update mysite --backends=192.168.1.2:3000,192.168.1.2:3001,192.168.1.3:3000,192.168.1.3:3001
```

*You can use hostnames too.*

Now we've added ecommerce and we need a secure site:

```
mechanic update mysite --https=true
```

Now nginx will serve the site with `https` (as well as `http`) and look for `mysite.cer` and `mysite.key` in the folder `/etc/nginx/certs`.

[See the nginx docs on how to handle intermediate certificates.](http://nginx.org/en/docs/http/configuring_https_servers.html)

Next we decide we want the site to be secure all the time, redirecting any traffic that arrives at the insecure site:

```
mechanic update mysite --https=true --redirect-to-https=true
```

Now we've decided we don't want ecommerce anymore. Let's shut that off:

```
mechanic update mysite --https=false
```

Now let's remove the site completely:

```
mechanic remove mysite
```

You can disable any previously set option, such as `static`, by setting it to `false` or the empty string.

## Falling back to Apache

If you also want to serve some content with Apache on the same server, first configure Apache to listen on port `9898` instead of `80`, then set up a default site for `mechanic` that forwards traffic there:

```javascript
mechanic add apache --ports=9898 --default=true
```

Apache doesn't have to be your default. You could also use `--host` and set up individual sites to be forwarded to Apache.

## Global options

There are a few global options you might want to change. Here's how. The values shown are the defaults.

```javascript
mechanic set conf /etc/nginx
```

This is the folder where `nginx` configuration files live.

```javascript
mechanic set restart "nginx -s reload"
```

*Don't forget the quotes if spaces are present.* That's just how the shell works, but it bears repeating.

The command to restart `nginx`.

```javascript
mechanic set logs /var/log/nginx
```

If this isn't where you want your nginx load files, change the setting.

```javascript
mechanic set bind "*"
```

By default, `mechanic` tells nginx to accept traffic on all IP addresses assigned to the server. (`*` means "everything.") If this isn't what you want, set a specific ip address with `bind`.

*If you reset this setting to `*` make sure you quote it, so the shell doesn't give you a list of filenames.*

```javascript
mechanic set template /etc/mechanic/custom.conf
```

You don't have to use our nginx configuration template.

Take a look at the file `template.conf` in the `nginx` npm module. It's just a [nunjucks](http://mozilla.github.io/nunjucks/) template that builds an `nginx` configuration based on your `mechanic` settings.

You can copy that template anywhere you like, make your own modifications, then use `mechanic set template` to tell `mechanic` where to find it.

## Refreshing after an update to mechanic itself

If we release a new update to `mechanic` that produces a better nginx configuration, you'll want to update mechanic, then refresh your nginx configuration files without actually changing any of your site settings. Just do this:

```
npm install -g mechanic
mechanic refresh
```

## Resetting to the defaults

To completely reset mechanic, throwing away everything it knows:

```javascript
mechanic reset
```

*Warning:* like it says, this will completely reset your configuration and forget everything you've done. Don't do that unless you really want to.

## Listing your configuration settings

`mechanic list`

This gives you back commands sufficient to set them up the same way again. Great for copying to another server. Here's some sample output:

```
mechanic set restart "/usr/sbin/nginx -s reload"
mechanic add test --host=test.com --aliases=www.test.com --canonical=true --https=true
mechanic add test2 --host=test2.com --aliases=www.test2.com,test2-prelaunch.mycompany.com
```

If you want to wipe the configuration on another server before applying these commands there, use `mechanic reset`.

## Custom nginx templates

You don't have to use our nginx configuration template.

Take a look at the file `template.conf` in the `nginx` npm module. It's just a [nunjucks](http://mozilla.github.io/nunjucks/) template that builds an `nginx` configuration based on your `mechanic` settings.

## Storing the database in a different place

It's stored in `/var/lib/misc/mechanic.json`. That's [one hundred percent correct according to the filesystem hierarchy standard](http://www.pathname.com/fhs/pub/fhs-2.3.pdf), adhered to by all major Linux distributions and many other flavors of Unix. But if you absolutely insist, you can use the `--data` option to specify another location. You'll have to do it every time you run `mechanic`, though. That's why we only use this option for unit tests.

If necessary `mechanic` will create `/var/lib/misc`.

## Credits

`mechanic` was created to facilitate our work at [P'unk Avenue](http://punkave.com). We use it to host sites powered by [Apostrophe](https://apostrophenow.org).

