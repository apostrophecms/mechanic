var fs = require('fs');

var shelljs = require('shelljs');

if (fs.existsSync('./mechanic-overrides/mysite/location')) {
  fs.unlinkSync('./mechanic-overrides/mysite/location');
}

if (fs.existsSync(__dirname + '/test.json')) {
  fs.unlinkSync(__dirname + '/test.json');
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
  "sites": [
    {
      "shortname": "mysite",
      "host": "mysite.com",
      "backends": [ 'localhost:3000' ]
    }
  ]
}, 'Test failed: adding a site should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json update mysite --aliases=www.mysite.com,mysite.temporary.com');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  "sites": [
    {
      "shortname": "mysite",
      "host": "mysite.com",
      "backends": [ 'localhost:3000' ],
      "aliases": [ 'www.mysite.com', 'mysite.temporary.com' ]
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
  "sites": []
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
  "sites": [
    {
      "shortname": "site1",
      "host": "site1.com",
      "backends": [ 'localhost:3000' ],
      "https": true
    },
    {
      "shortname": "site2",
      "host": "site2.com",
      "backends": [ 'localhost:3001' ],
      "https": true
    },
  ]
}, 'Test failed: adding two sites with https should store the right JSON');

shelljs.exec('node ../app.js --data=./test.json update site2 --host=site2.com --backends=3001 --https --redirect-to-https');

expect({
  settings: {
    conf: './nginx',
    logs: './logs',
    restart: 'touch restarted',
    overrides: './mechanic-overrides',
    bind: '*'
  },
  "sites": [
    {
      "shortname": "site1",
      "host": "site1.com",
      "backends": [ 'localhost:3000' ],
      "https": true
    },
    {
      "shortname": "site2",
      "host": "site2.com",
      "backends": [ 'localhost:3001' ],
      "https": true,
      "redirect-to-https": true
    },
  ]
}, 'Test failed: redirect-to-https should add the right JSON');

var output = shelljs.exec('node ../app.js --data=./test.json list', { silent: true }).output;

var expected = "mechanic set conf './nginx'\n" +
  "mechanic set logs './logs'\n" +
  "mechanic set restart 'touch restarted'\n" +
  "mechanic set overrides './mechanic-overrides'\n" +
  "mechanic add site1 '--host=site1.com' '--backends=localhost:3000' '--https=true'\n" +
  "mechanic add site2 '--host=site2.com' '--backends=localhost:3001' '--https=true' '--redirect-to-https=true'\n";

if (output !== expected) {
  console.error("Test failed: --list did not output correct commands to establish the two sites again");
  console.error('GOT:');
  console.error(output);
  console.error('EXPECTED:');
  console.error(expected);
  process.exit(1);
}

if (!fs.existsSync('./mechanic-overrides/mysite/location')) {
  console.error('location override file for mysite does not exist');
  process.exit(1);
}

function expect(correct, message) {
  var data = JSON.parse(fs.readFileSync('test.json', 'utf8'));
  if (JSON.stringify(data) !== JSON.stringify(correct)) {
    console.error(message);
    console.error(data);
    process.exit(1);
  }
}
