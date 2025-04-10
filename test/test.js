const fs = require('fs');

const shelljs = require('shelljs');

if (fs.existsSync('./mechanic-overrides/mysite/location')) {
  fs.unlinkSync('./mechanic-overrides/mysite/location');
}

if (fs.existsSync(__dirname + '/test.json')) {
  fs.unlinkSync(__dirname + '/test.json');
}

if (!fs.existsSync(__dirname + '/nginx')) {
  fs.mkdirSync(__dirname + '/nginx');
}

fs.writeFileSync(__dirname + '/nginx/nginx.conf', '# test conf file');

fs.writeFileSync(__dirname + '/test.json', fs.readFileSync(__dirname + '/initial-db.json', 'utf8'));

shelljs.exec('node ../app.js --data=./test.json add mysite --host=mysite.com --backends=3000');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'mysite',
      host: 'mysite.com',
      backends: [ 'localhost:3000' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    }
  ]
}, 'Test failed: adding a site should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json update mysite --host=mysite.com --backend=localhost:3001');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'mysite',
      host: 'mysite.com',
      backends: [ 'localhost:3001' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3001' ]
        }
      ]
    }
  ]
}, 'Test failed: alias was not accepted, or update command rejected, or host:port parsed badly');

// back to port 3000 which other tests want to see

shelljs.exec('node ../app.js --data=./test.json update mysite --host=mysite.com --backends=3000');

// test a bogus option

const result = shelljs.exec('node ../app.js --data=./test.json update mysite --host=mysite.com --backends=3000 --ludicrous', { silent: true });
if (!result.output.match(/Unrecognized option: ludicrous/)) {
  console.error('Test failed: bogus option did not result in error.');
  process.exit(1);
}

shelljs.exec('node ../app.js --data=./test.json update mysite --aliases=www.mysite.com,mysite.temporary.com');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'mysite',
      host: 'mysite.com',
      backends: [ 'localhost:3000' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ],
      aliases: [ 'www.mysite.com', 'mysite.temporary.com' ]
    }
  ]
}, 'Test failed: updating a site should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json remove mysite');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: []
}, 'Test failed: removing a site should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json add site1 --host=site1.com --backends=3000 --https');
shelljs.exec('node ../app.js --data=./test.json add site2 --host=site2.com --backends=3001 --https');
expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'site1',
      host: 'site1.com',
      backends: [ 'localhost:3000' ],
      https: true,
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    },
    {
      shortname: 'site2',
      host: 'site2.com',
      backends: [ 'localhost:3001' ],
      https: true,
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3001' ]
        }
      ]
    }
  ]
}, 'Test failed: adding two sites with https should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json update site2 --host=site2.com --backends=3001 --https --redirect-to-https --websockets');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'site1',
      host: 'site1.com',
      backends: [ 'localhost:3000' ],
      https: true,
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    },
    {
      shortname: 'site2',
      host: 'site2.com',
      backends: [ 'localhost:3001' ],
      https: true,
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3001' ]
        }
      ],
      'redirect-to-https': true,
      websockets: true
    }
  ]
}, 'Test failed: redirect-to-https should add the right JSON');

const output = shelljs.exec('node ../app.js --data=./test.json list', { silent: true }).output;

const expected = 'mechanic set conf \'./nginx\' \n\n' +
  'mechanic set logs \'./logs\' \n\n' +
  'mechanic set restart \'touch restarted\' \n\n' +
  'mechanic set overrides \'./mechanic-overrides\' \n\n' +
  'mechanic add site1 \'--host=site1.com\' \'--backends=localhost:3000\' \'--https=true\' \n\n' +
  'mechanic add site2 \'--host=site2.com\' \'--backends=localhost:3001\' \'--https=true\' \'--redirect-to-https=true\' \'--websockets=true\' \n\n';

if (output !== expected) {
  console.error('Test failed: --list did not output correct commands to establish the two sites again');
  console.error('GOT:');
  console.error(output);
  console.error('EXPECTED:');
  console.error(expected);
  process.exit(1);
}

shelljs.exec('node ../app.js --data=./test.json remove site1');
shelljs.exec('node ../app.js --data=./test.json remove site2');
shelljs.exec('node ../app.js --data=./test.json add defaultsite --host=defaultsite.com --default --backends=3000');
shelljs.exec('node ../app.js --data=./test.json add nondefaultsite --host=nondefaultsite.com --backends=3000');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'nondefaultsite',
      host: 'nondefaultsite.com',
      backends: [ 'localhost:3000' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    },
    {
      shortname: 'defaultsite',
      host: 'defaultsite.com',
      default: true,
      backends: [ 'localhost:3000' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    }
  ]
}, 'Test failed: default site should always wind up at the end of the list');

shelljs.exec('node ../app.js --data=./test.json update defaultsite --backends=localhost:3000,localhost:4000/ci-server');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  sites: [
    {
      shortname: 'nondefaultsite',
      host: 'nondefaultsite.com',
      backends: [ 'localhost:3000' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        }
      ]
    },
    {
      shortname: 'defaultsite',
      host: 'defaultsite.com',
      default: true,
      backends: [ 'localhost:3000', 'localhost:4000/ci-server' ],
      backendGroups: [
        {
          path: '/',
          backends: [ 'localhost:3000' ]
        },
        {
          path: '/ci-server',
          backends: [ 'localhost:4000' ]
        }
      ]
    }
  ]
}, 'Test failed: ci server backend not listed properly');

if (!fs.existsSync('./mechanic-overrides/mysite/location')) {
  console.error('location override file for mysite does not exist');
  process.exit(1);
}

function expect(correct, message) {
  const data = JSON.parse(fs.readFileSync('test.json', 'utf8'));
  if (JSON.stringify(data) !== JSON.stringify(correct)) {
    console.error(message);
    console.error('EXPECTED:');
    console.error(JSON.stringify(correct));
    console.error('ACTUAL:');
    console.error(JSON.stringify(data));
    process.exit(1);
  }
}
