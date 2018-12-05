/* global describe, it, afterEach */

var assert = require('chai').assert;
var captureHar = require('./captureHar');
var lolex = require('lolex');
var utils = require('./utils');
var net = require('net');

describe('redirect', function () {
  afterEach(function () {
    if (this.clock) {
      this.clock.uninstall();
    }
    return utils.cleanMocks();
  });

  it('handles invalid redirects', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.end();
    })
      .then(() => captureHar({ url: 'http://localhost:3000' }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.lengthOf(har.log.entries, 1);
        assert.deepPropertyVal(har, 'log.entries[0].response._error.message', 'Missing location header');
        assert.deepPropertyVal(har, 'log.entries[0].response._error.code', 'NOLOCATION');
      });
  });

  it('records redirects', function () {
    this.clock = lolex.install(1262304000000);
    return utils.mockServer(3000, (req, res) => {
      if (req.url === '/') {
        this.clock.tick(1000);
        res.statusCode = 301;
        res.setHeader('location', '/maps');
        res.end();
      } else if (req.url === '/maps') {
        this.clock.tick(2000);
        res.statusCode = 200;
        res.end('body');
      }
    })
      .then(() => captureHar({ url: 'http://localhost:3000' }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].startedDateTime', '2010-01-01T00:00:00.000Z');
        assert.deepPropertyVal(har, 'log.entries[0].time', 1000);

        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.redirectURL', 'http://localhost:3000/maps');

        assert.deepPropertyVal(har, 'log.entries[1].startedDateTime', '2010-01-01T00:00:01.000Z');
        assert.deepPropertyVal(har, 'log.entries[1].time', 2000);

        assert.notDeepProperty(har, 'log.entries[1].response._error');
        assert.notDeepProperty(har, 'log.entries[1].response._error');
      });
  });

  it('can disable automatic redirect', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', '/maps');
      res.end();
    })
      .then(() => captureHar({ url: 'http://localhost:3000', followRedirect: false }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.redirectURL', 'http://localhost:3000/maps');
        assert.lengthOf(har.log.entries, 1);
      });
  });

  it('can do maxRedirects', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', '/');
      res.end();
    })
      .then(() => captureHar({ url: 'http://localhost:3000', maxRedirects: 5 }))
      .then(har => {
        assert.lengthOf(har.log.entries, 6);
        assert.deepPropertyVal(har, 'log.entries[5].response._error.message', 'Max redirects exceeded');
        assert.deepPropertyVal(har, 'log.entries[5].response._error.code', 'MAXREDIRECTS');
      });
  });

  it('can do followRedirect by function', function () {
    return utils.mockServer(3000, (req, res) => {
      if (req.url === '/') {
        res.statusCode = 301;
        res.setHeader('location', '/1');
        res.setHeader('redirect', '1');
        res.end();
      } else if (req.url === '/1') {
        res.statusCode = 301;
        res.setHeader('location', '/2');
        res.end();
      } else if (req.url === '/2') {
        res.end();
      }
    })
      .then(() => captureHar({
        url: 'http://localhost:3000',
        followRedirect: (res) => {
          return !!res.headers.redirect;
        }
      }))
      .then(har => {
        assert.lengthOf(har.log.entries, 2);
      });
  });

  it('handles location header on other statuscodes', function () {
    return utils.mockServer(3000, (req, res) => {
      res.setHeader('location', '/path');
      res.end();
    })
      .then(() => captureHar({ url: 'http://localhost:3000' }))
      .then(har => {
        assert.lengthOf(har.log.entries, 1);
      });
  });

  it('redirect should rewrite the host header when it was defined', function () {
    return Promise.all([
      utils.mockServer(3000, (req, res) => {
        res.statusCode = 301;
        res.setHeader('location', 'http://localhost:3001');
        res.end(`${req.rawHeaders[0]}: ${req.rawHeaders[1]}`);
      }),
      utils.mockServer(3001, (req, res) => res.end(`${req.rawHeaders[0]}: ${req.rawHeaders[1]}`))
    ])
      .then(() => captureHar({
        url: 'http://localhost:3000',
        headers: {
          Host: 'localhost:3000'
        }
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.content.text', 'Host: localhost:3000');
        assert.deepPropertyVal(har, 'log.entries[1].response.content.text', 'Host: localhost:3001');

        assert.deepPropertyVal(har, 'log.entries[0].request.headers[0].name', 'host');
        assert.deepPropertyVal(har, 'log.entries[0].request.headers[0].value', 'localhost:3000');
        assert.deepPropertyVal(har, 'log.entries[1].request.headers[0].name', 'host');
        assert.deepPropertyVal(har, 'log.entries[1].request.headers[0].value', 'localhost:3001');
      });
  });

  it('redirect should rewrite the host header when it was missing', function () {
    return Promise.all([
      utils.mockServer(3000, (req, res) => {
        res.statusCode = 301;
        res.setHeader('location', 'http://localhost:3001');
        res.end(`${req.rawHeaders[0]}: ${req.rawHeaders[1]}`);
      }),
      utils.mockServer(3001, (req, res) => res.end(`${req.rawHeaders[0]}: ${req.rawHeaders[1]}`))
    ])
      .then(() => captureHar({
        url: 'http://localhost:3000',
        headers: {}
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.content.text', 'host: localhost:3000');
        assert.deepPropertyVal(har, 'log.entries[1].response.content.text', 'host: localhost:3001');

        assert.deepPropertyVal(har, 'log.entries[0].request.headers[0].name', 'host');
        assert.deepPropertyVal(har, 'log.entries[0].request.headers[0].value', 'localhost:3000');
        assert.deepPropertyVal(har, 'log.entries[1].request.headers[0].name', 'host');
        assert.deepPropertyVal(har, 'log.entries[1].request.headers[0].value', 'localhost:3001');
      });
  });

  it('redirect should log response information on unsupported protocol', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', 'file:///etc/passwd');
      res.end();
    })
      .then(() => captureHar({
        url: 'http://localhost:3000'
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.headers[0].name', 'location');
        assert.deepPropertyVal(har, 'log.entries[0].response.headers[0].value', 'file:///etc/passwd');

        assert.deepPropertyVal(har, 'log.entries[1].request.url', 'file:///etc/passwd');
        assert.deepPropertyVal(har, 'log.entries[1].request.headers.length', 0);

        assert.deepPropertyVal(har, 'log.entries[1].response._error.message', 'Invalid URI "file:///etc/passwd"');
      });
  });

  it('redirect should log correct host and url on IPv6 ip addresses', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', 'http://[::1]:3000/');
      res.end();
    })
      .then(() => captureHar({
        url: 'http://localhost:3000',
        followRedirect: true,
        maxRedirects: 1
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.redirectURL', 'http://[::1]:3000/');
      });
  });

  it('redirect should add trailing slash if not specified in location header', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', 'http://localhost:3000');
      res.end();
    })
      .then(() => captureHar({
        url: 'http://localhost:3000',
        followRedirect: true,
        maxRedirects: 1
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.redirectURL', 'http://localhost:3000/');
      });
  });

  it('redirect should resolve relative URLs', function () {
    return utils.mockServer(3000, (req, res) => {
      res.statusCode = 301;
      res.setHeader('location', '../../../../');
      res.end();
    })
      .then(() => captureHar({
        url: 'http://localhost:3000',
        followRedirect: true,
        maxRedirects: 1
      }))
      .then(har => {
        assert.deepPropertyVal(har, 'log.entries[0].response.status', 301);
        assert.deepPropertyVal(har, 'log.entries[0].response.redirectURL', 'http://localhost:3000/');
      });
  });

  it('should have remoteAddress after redirect', function () {
    return captureHar({
      url: 'http://woorank.com',
      followRedirect: true
    })
      .then(har => {
        assert(net.isIP(har.log.entries[1].response._remoteAddress));
      });
  });
});
