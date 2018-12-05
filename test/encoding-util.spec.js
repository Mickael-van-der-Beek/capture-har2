/* global describe, it */

var assert = require('chai').assert;
var encodingUtil = require('../lib/encoding-util');

describe('encodingUtil', function () {
  it('transformBinaryToUtf8', function () {
    var i = 0;
    var max = Math.pow(2, 16) - 1;
    var realChar = null;
    var transmitChar = null;

    while (i < max) {
      i += 1;
      realChar = Buffer.from([i], 'utf8').toString('utf8');
      transmitChar = Buffer
        .from(realChar, 'utf8')
        .reduce((chars, byte) => chars + String.fromCharCode(byte), '');
      assert.strictEqual(realChar, encodingUtil.transformBinaryToUtf8(transmitChar), i);
    }
  });
});
