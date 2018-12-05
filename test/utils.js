var https = require('https');
var http = require('http');

var protocols = {
  https,
  http
};

function log (har) {
  console.log(require('util').inspect(har, {
    depth: 10,
    colors: true
  }));
}

var mocks = [];
function mockServer (port, handler, protocol = 'http') {
  var mock = new Promise((resolve, reject) => {
    var app = protocols[protocol].createServer(handler);
    var server = app.listen(port, err => {
      if (err) {
        reject(err);
      } else {
        resolve({
          close () {
            return new Promise((resolve, reject) => {
              server.close(err => err ? reject(err) : resolve());
            });
          }});
      }
    });
  });
  mocks.push(mock);
  return mock;
}

function cleanMocks () {
  return Promise.all(mocks)
    .then(servers => {
      return Promise.all(servers.map(server => server.close()));
    })
    .then(() => {
      mocks = [];
    });
}

module.exports = {
  log,
  mockServer,
  cleanMocks
};
