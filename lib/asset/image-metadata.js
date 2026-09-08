'use strict';

const fs = require('fs');

const MAX_HEADER_BYTES = 128 * 1024;

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {return null;}
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) {offset += 1;}
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9) {continue;}
    if (marker === 0xda || offset + 2 > buffer.length) {break;}
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) {break;}
    if (sof.has(marker) && length >= 7) {
      return { type: 'jpeg', width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return { type: 'jpeg', width: 0, height: 0 };
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      type: 'webp',
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    return {
      type: 'webp',
      width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
      height: 1 + ((buffer[22] & 0xc0) >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10),
    };
  }
  if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return {
      type: 'webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  return { type: 'webp', width: 0, height: 0 };
}

function svgDimensions(buffer) {
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 8192));
  if (!/<svg\b/i.test(text)) {return null;}
  const width = Number((text.match(/\bwidth=["']([\d.]+)/i) || [])[1] || 0);
  const height = Number((text.match(/\bheight=["']([\d.]+)/i) || [])[1] || 0);
  if (width > 0 && height > 0) {return { type: 'svg', width, height };}
  const viewBox = (text.match(/\bviewBox=["']([^"']+)["']/i) || [])[1] || '';
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  return { type: 'svg', width: Number(values[2] || 0), height: Number(values[3] || 0) };
}

/** 读取图片头中的格式和尺寸。 */
function parseImageMetadata(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) {return { type: '', width: 0, height: 0 };}
  if (buffer.length >= 24 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
    return { type: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (/^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) {
    return { type: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.toString('ascii', 0, 2) === 'BM' && buffer.length >= 26) {
    return { type: 'bmp', width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
  }
  return jpegDimensions(buffer) || webpDimensions(buffer) || svgDimensions(buffer) || { type: '', width: 0, height: 0 };
}

/** 读取本地图片的格式和尺寸，不加载完整文件。 */
function readImageMetadata(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return parseImageMetadata(buffer.subarray(0, bytesRead));
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  MAX_HEADER_BYTES,
  parseImageMetadata,
  readImageMetadata,
};
