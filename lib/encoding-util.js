'use strict';

function transformBinaryToUtf8 (value) {
  if (value === undefined || value === null) {
    return value;
  }

  return Buffer.from(String(value), 'binary').toString('utf8');
}

module.exports = {
  transformBinaryToUtf8: transformBinaryToUtf8
};
