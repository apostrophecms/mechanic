var argv = require('yargs').argv;
var _ = require('lodash');
var fs = require('fs');
var shelljs = require('shelljs');
var resolve = require('path').resolve;
var shellEscape = require('shell-escape');

var dataFile;
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
    fs.mkdirSync('/var/lib/misc', 0700);
  }
}


var data = require('prettiest')({ json: dataFile });

var defaultSettings = {
  conf: '/etc/nginx/conf.d',
  logs: '/var/log/nginx',
  restart: 'nginx -s reload',
  bind: '*'
};

_.defaults(data, { settings: {} });
_.defaults(data.settings, defaultSettings);

var settings = data.settings;

var nunjucks = require('nunjucks');

var command = argv._[0];
if (!command) {
  usage();
}

var options = {
  'host': 'string',
  'backends': 'addresses',
  'aliases': 'strings',
  'canonical': 'boolean',
  'default': 'boolean',
  'static': 'string',
  'https': 'boolean',
  'redirect-to-https': 'boolean'
};

var parsers = {
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
      var matches = s.match(/^(([^:]+)\:)?(\d+)$/);
      if (!matches) {
        throw 'A list of port numbers and/or address:port combinations is expected, separated by commas';
      }
      var host, port;
      if (matches[1]) {
        host = matches[1];
      } else {
        host = 'localhost';
      }
      port = matches[3];
      return host + ':' + port;
    });
  },
  strings: function(s) {
    return s.toString().split(/\s*\,\s*/);
  },
  boolean: function(s) {
    return (s === 'true') || (s === 'on') || (s == 1);
  },
  // Have a feeling we'll use this soon
  keyValue: function(s) {
    var s = parsers.string(s);
    var o = {};
    _.each(s, function(v) {
      var matches = v.match(/^([^:]+):(.*)$/);
      if (!matches) {
        throw 'Key-value pairs expected, like this: key:value,key:value';
      }
      o[matches[1]] = matches[2];
    });
    return o;
  }
};

var stringifiers = {
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
    return s ? 'true' : 'false'
  },
  keyValue: function(o) {
    return _.map(o, function(v, k) {
      return k + ':' + v;r
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
    usage("The \"set\" command requires two parameters:\n\nmechanic set key value");
  }
  var key = argv._[1];
  var value = argv._[2];
  data.settings[argv._[1]] = argv._[2];
  go();
}

function update(add) {
  if (argv._.length !== 2) {
    usage('shortname argument is required; also --host');
  }

  var shortname = argv._[1];
  var site;

  if (add) {
    if (findSite(shortname)) {
      usage('Site already exists, use update');
    } else {
      site = { shortname: shortname };
      data.sites.push(site);
    }
  } else {
    site = findSite(shortname);
    if (!site) {
      usage('Unknown site: ' + shortname);
    }
  }

  _.each(argv, function(val, key) {
    if ((key === '_') || (key === 'c') || (key.substr(0, 1) === '$')) {
      return;
    }
    if (!_.has(options, key)) {
      usage('Unrecognized option: ' + key);
    }
    try {
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

  var shortname = argv._[1];

  var found = false;
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

function go() {
  var template = fs.readFileSync(settings.template || (__dirname + '/template.conf'), 'utf8');

  var output = nunjucks.renderString(template, {
    sites: data.sites,
    settings: settings
  });

  fs.writeFileSync(settings.conf + '/mechanic.conf', output);

  if (settings.restart !== false) {
    var restart = settings.restart || 'service nginx reload';
    if (shelljs.exec(restart).code !== 0) {
      console.error('ERROR: unable to reload nginx configuration!');
      process.exit(3);
    }
  }

  // Under 0.12 (?) this doesn't want to terminate on its own,
  // not sure who the culprit is
  process.exit(0);
}

function findSite(shortname)
{
  return _.find(data.sites, function(site) {
    return site.shortname === shortname;
  });
}

function list()
{
  _.each(data.settings, function(val, key) {
    if (val !== defaultSettings[key]) {
      console.log(shellEscape([ 'mechanic', 'set', key, val ]));
    }
  });
  _.each(data.sites, function(site) {
    var words = [ 'mechanic', 'add', site.shortname ];
    _.each(site, function(val, key) {
      if (_.has(stringifiers, options[key])) {
        words.push('--' + key + '=' + stringifiers[options[key]](val));
      }
    });
    console.log(shellEscape(words));
  });
}
