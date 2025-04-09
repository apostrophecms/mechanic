const argv = require('boring')();
const _ = require('lodash');
const fs = require('fs');
const shelljs = require('shelljs');
const shellEscape = require('shell-escape');

let dataFile;
if (argv.data) {
  dataFile = argv.data;
  delete argv.data;
} else {
  dataFile = '/var/lib/misc/mechanic.json';
  // The Unix File Hierarchy Standard says that all distros should
  // have a /var/lib/misc folder for storage of "state files
  // that don't need a directory." But create it if it's
  // somehow missing (Mac for instance).
  if (!fs.existsSync('/var/lib/misc')) {
    fs.mkdirSync('/var/lib/misc', 0o700);
  }
}

const data = require('prettiest')({ json: dataFile });

const defaultSettings = {
  conf: '/etc/nginx/conf.d',
  overrides: '/etc/nginx/mechanic-overrides',
  logs: '/var/log/nginx',
  restart: 'nginx -s reload',
  bind: '*'
};

_.defaults(data, { settings: {} });
_.defaults(data.settings, defaultSettings);

const settings = data.settings;

const nunjucks = require('@apostrophecms/nunjucks');

const command = argv._[0];
if (!command) {
  usage();
}

const aliases = {
  backend: 'backends'
};

const options = {
  host: 'string',
  backends: 'addresses',
  aliases: 'strings',
  canonical: 'boolean',
  default: 'boolean',
  static: 'string',
  autoindex: 'boolean',
  https: 'boolean',
  http2: 'boolean',
  'redirect-to-https': 'boolean',
  'https-upstream': 'boolean',
  websocket: 'boolean', // Included for accidental BC coverage.
  websockets: 'boolean',
  redirect: 'string',
  'redirect-full': 'string',
  permanent: 'boolean',
  path: 'string'
};

const parsers = {
  string: function(s) {
    return s.trim();
  },
  integer: function(s) {
    return parseInt(s, 10);
  },
  integers: function(s) {
    return _.map(parsers.strings(s), function(s) {
      return parsers.integer(s);
    });
  },
  addresses: function(s) {
    return _.map(parsers.strings(s), function(s) {
      const matches = s.match(/^(([^:]+):)?(\d+)(\/.*)?$/);
      if (!matches) {
        throw 'A list of port numbers and/or address:port combinations with optional paths is expected, separated by commas';
      }
      let host = 'localhost';
      if (matches[2]) {
        host = matches[2];
      }

      const port = matches[3];
      const path = matches[4];
      const pathString = (path != null) ? path : '';
      return `${host}:${port}${pathString}`;
    });
  },
  strings: function(s) {
    return s.toString().split(/\s*,\s*/);
  },
  boolean: function(s) {
    // eslint-disable-next-line eqeqeq
    return (s === 'true') || (s === 'on') || (s == 1);
  },
  // Have a feeling we'll use this soon
  keyValue: function(s) {
    s = parsers.string(s);
    const o = {};
    _.each(s, function(v) {
      const matches = v.match(/^([^:]+):(.*)$/);
      if (!matches) {
        throw 'Key-value pairs expected, like this: key:value,key:value';
      }
      o[matches[1]] = matches[2];
    });
    return o;
  }
};

const stringifiers = {
  string: function(s) {
    return s;
  },
  integer: function(s) {
    return s;
  },
  strings: function(s) {
    return s.join(',');
  },
  boolean: function(s) {
    return s ? 'true' : 'false';
  },
  keyValue: function(o) {
    return _.map(o, function(v, k) {
      return k + ':' + v;
    }).join(',');
  },
  addresses: function(s) {
    return s.join(',');
  }
};

data.sites = data.sites || [];

if (command === 'add') {
  update(true);
} else if (command === 'update') {
  update(false);
} else if (command === 'remove') {
  remove();
} else if (command === 'refresh') {
  refresh();
} else if (command === 'list') {
  list();
} else if (command === 'set') {
  set();
} else if (command === 'reset') {
  reset();
} else {
  usage();
}

function usage(m) {
  if (m) {
    console.error(m);
  }
  console.error('See https://github.com/punkave/mechanic for usage.');
  process.exit(1);
}

function set() {
  // Top-level settings: nginx conf folder, logs folder,
  // and restart command
  if (argv._.length !== 3) {
    usage('The "set" command requires two parameters:\n\nmechanic set key value');
  }

  data.settings[argv._[1]] = argv._[2];
  go();
}

function update(add) {
  if (argv._.length !== 2) {
    usage('shortname argument is required; also --host');
  }

  const shortname = argv._[1];
  let site;

  if (add) {
    if (findSite(shortname)) {
      usage('Site already exists, use update');
    } else {
      site = { shortname };
      data.sites.push(site);
    }
  } else {
    site = findSite(shortname);
    if (!site) {
      usage('Unknown site: ' + shortname);
    }
  }

  _.each(argv, function(val, key) {
    if (key === '_') {
      return;
    }

    if (_.has(aliases, key)) {
      key = aliases[key];
    }

    if (!_.has(options, key)) {
      usage('Unrecognized option: ' + key);
    }
    try {
      if (key === 'redirect') {
        delete site['redirect-full'];
      } else if (key === 'redirect-full') {
        delete site.redirect;
      }
      site[key] = parsers[options[key]](val);
    } catch (e) {
      console.error(e);
      usage('Value for ' + key + ' must be of type: ' + options[key]);
    }
  });

  go();
}

function remove() {
  if (argv._.length !== 2) {
    usage();
  }

  const shortname = argv._[1];

  let found = false;
  data.sites = _.filter(data.sites || [], function(site) {
    if (site.shortname === shortname) {
      found = true;
      return false;
    }
    return true;
  });

  if (!found) {
    // It's not fatal but it's warning-worthy
    console.error('Not found: ' + shortname);
    return;
  }

  go();
}

function refresh() {
  go();
}

function validSiteFilter(site) {
  if ((!(site.backends && site.backends.length)) && (!site.static) && (!site.redirect) && (!site['redirect-full'])) {
    console.warn('WARNING: skipping ' + site.shortname + ' because no backends have been specified (hint: --backends=portnumber)');
    return false;
  }
  return true;
}

function go() {

  // Reorder the sites so that default servers come after
  // all others. According to the nginx documentation this
  // shouldn't matter because any explicit server_name matches
  // should win, but we've seen exceptions, and this is
  // aesthetically pleasing anyway. -Tom

  _.each(data.sites, function(site, i) {
    site._index = i;
  });

  data.sites.sort(function(a, b) {
    if (a.default === b.default) {
      if (a._index < b._index) {
        return -1;
      } else if (b._index > a._index) {
        return 1;
      }

      return 0;
    } else {
      if (a.default) {
        return 1;
      } else if (b.default) {
        return -1;
      }
      return 0;
    }
  });

  _.each(data.sites, function(site) {
    delete site._index;
  });

  let sites = _.filter(data.sites, validSiteFilter);

  sites = sites.map(site => {
    site.backends = site.backends || [];
    site.backends.sort((b1, b2) => {
      const p1 = pathOf(b1);
      const p2 = pathOf(b2);
      if (p1 < p2) {
        return -1;
      } else if (p2 > p1) {
        return 1;
      } else {
        return 0;
      }
    });
    site.backendGroups = [];
    let lastPath = null;
    let group;
    for (const backend of site.backends) {
      if (pathOf(backend) !== lastPath) {
        group = {
          path: pathOf(backend),
          backends: [ withoutPath(backend) ]
        };
        lastPath = pathOf(backend);
      } else {
        group.backends.push(withoutPath(backend));
      }
      if (group.backends.length === 1) {
        site.backendGroups.push(group);
      }
    }
    return site;
  });

  const template = fs.readFileSync(settings.template || (__dirname + '/template.conf'), 'utf8');

  const output = nunjucks.renderString(template, {
    sites,
    settings
  });

  // Set up include-able files to allow
  // easy customizations
  _.each(sites, function(site) {
    let folder = settings.overrides;
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
    folder += '/' + site.shortname;
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
    const files = [ 'location', 'proxy', 'server', 'top' ];
    _.each(files, function(file) {
      const filename = folder + '/' + file;
      if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, '# Your custom nginx directives go here\n');
      }
    });
  });

  fs.writeFileSync(settings.conf + '/mechanic.conf', output);

  if (settings.restart !== false) {
    const restart = settings.restart || 'service nginx reload';
    if (shelljs.exec(restart).code !== 0) {
      console.error('ERROR: unable to reload nginx configuration!');
      process.exit(3);
    }
  }

  // Under 0.12 (?) this doesn't want to terminate on its own,
  // not sure who the culprit is
  process.exit(0);
}

function findSite(shortname) {
  return _.find(data.sites, function(site) {
    return site.shortname === shortname;
  });
}

function list() {
  _.each(data.settings, function(val, key) {
    if (val !== defaultSettings[key]) {
      console.info(shellEscape([ 'mechanic', 'set', key, val ]), '\n');
    }
  });
  _.each(data.sites, function(site) {
    const words = [ 'mechanic', 'add', site.shortname ];
    _.each(site, function(val, key) {
      if (_.has(stringifiers, options[key])) {
        words.push('--' + key + '=' + stringifiers[options[key]](val));
      }
    });
    console.info(shellEscape(words), '\n');
  });
}

function reset() {
  data.settings = defaultSettings;
  data.sites = [];
  go();
}

function pathOf(backend) {
  const slashAt = backend.indexOf('/');
  if (slashAt !== -1) {
    return backend.substring(slashAt);
  } else {
    return '/';
  }
}

function withoutPath(backend) {
  const slashAt = backend.indexOf('/');
  if (slashAt !== -1) {
    return backend.substring(0, slashAt);
  } else {
    return backend;
  }
}
