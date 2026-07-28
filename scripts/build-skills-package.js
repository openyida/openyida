#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'yida-skills');
const SOURCE_SUBSKILLS_ROOT = path.join(SOURCE_ROOT, 'skills');
const SOURCE_SKILLS_INDEX_FILE = path.join(SOURCE_ROOT, 'skills-index.json');
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, 'dist', 'skills', 'openyida');
const DEFAULT_ZIP_OUT = path.join(ROOT, 'openyida-skills.zip');

function parseArgs(argv) {
  const options = {
    out: DEFAULT_OUTPUT_ROOT,
    zipOut: DEFAULT_ZIP_OUT,
    zip: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      options.out = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--zip-out') {
      options.zipOut = path.resolve(ROOT, argv[++i]);
      options.zip = true;
    } else if (arg === '--no-zip') {
      options.zip = false;
    }
  }

  return options;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

function transformSkillReferences(content, subskillReferencePattern) {
  return content
    .replace(/yida-skills\/SKILL\.md/g, '../../../SKILL.md')
    .replace(/skills\/([a-z0-9-]+)\/SKILL\.md/g, subskillReferencePattern)
    .replace(/\.\.\/([a-z0-9-]+)\/SKILL\.md/g, '../$1/README.md')
    .replace(/skills\/<技能名>\/SKILL\.md/g, 'references/subskills/<技能名>/README.md')
    .replace(/详见 SKILL\.md/g, '详见 README.md');
}

function copyReferencesRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyReferencesRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.md')) {
        const referenceRoot = path.join(SOURCE_ROOT, 'references');
        const relativeDir = path.relative(referenceRoot, path.dirname(srcPath));
        const depth = relativeDir ? relativeDir.split(path.sep).length : 0;
        const prefix = depth > 0 ? '../'.repeat(depth) : '';
        fs.writeFileSync(
          destPath,
          transformSkillReferences(readRequiredFile(srcPath), prefix + 'subskills/$1/README.md'),
          'utf8',
        );
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      count++;
    }
  }

  return count;
}

function readRequiredFile(src) {
  if (!fs.existsSync(src)) {
    throw new Error('Missing required file: ' + path.relative(ROOT, src));
  }

  return fs.readFileSync(src, 'utf8');
}

function writeRootSkill(src, dest) {
  const content = transformSkillReferences(readRequiredFile(src), 'references/subskills/$1/README.md')
    .replace(/详见 SKILL\.md/g, '详见 README.md')
    .replace('| 技能 | SKILL.md 路径 | 用途 | 典型命令 |', '| 技能 | README 路径 | 用途 | 典型命令 |')
    .replace('> 每个子技能均有独立的 SKILL.md。执行时先选定一个最匹配的子技能，只读取该子技能文档；references 按文档提示按需读取，避免一次性加载全量文档。',
      '> 悟空上传包只暴露一个根 SKILL.md；原子技能已打包到 references/subskills/，执行时先选定一个最匹配的子技能，只读取对应 README.md；references 按文档提示按需读取，避免一次性加载全量文档。');

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return 1;
}

function copySkillsIndex(outputRoot) {
  const dest = path.join(outputRoot, 'skills-index.json');
  const index = JSON.parse(readRequiredFile(SOURCE_SKILLS_INDEX_FILE));
  index.skills = index.skills.map(function(skill) {
    const sourcePath = skill.path;
    const match = /^skills\/([a-z0-9-]+)\/SKILL\.md$/.exec(sourcePath);
    if (!match || match[1] !== skill.name) {
      throw new Error('Invalid source skills-index path for ' + skill.name + ': ' + sourcePath);
    }
    return Object.assign({}, skill, {
      path: 'references/subskills/' + skill.name + '/README.md',
    });
  });
  fs.writeFileSync(dest, JSON.stringify(index, null, 2) + '\n', 'utf8');
  return 1;
}

function transformSubskillReference(content) {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/yida-skills\/SKILL\.md/g, '../../../SKILL.md')
    .replace(/skills\/([a-z0-9-]+)\/SKILL\.md/g, '../$1/README.md')
    .replace(/\.\.\/([a-z0-9-]+)\/SKILL\.md/g, '../$1/README.md')
    .replace(/详见 SKILL\.md/g, '详见 README.md');
}

function copySubskillAsReference(skillDirName, outputRoot) {
  const sourceDir = path.join(SOURCE_SUBSKILLS_ROOT, skillDirName);
  const destDir = path.join(outputRoot, 'references', 'subskills', skillDirName);

  if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    return 0;
  }

  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destName = entry.name === 'SKILL.md' ? 'README.md' : entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      count += copyDirRecursive(sourcePath, destPath);
    } else if (entry.isFile()) {
      if (entry.name === 'SKILL.md') {
        fs.writeFileSync(destPath, transformSubskillReference(readRequiredFile(sourcePath)), 'utf8');
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
      count++;
    }
  }

  return count;
}

function copySubskillsAsReferences(outputRoot) {
  if (!fs.existsSync(SOURCE_SUBSKILLS_ROOT)) {
    return 0;
  }

  const skillDirNames = fs.readdirSync(SOURCE_SUBSKILLS_ROOT).filter(function(name) {
    return fs.statSync(path.join(SOURCE_SUBSKILLS_ROOT, name)).isDirectory();
  }).sort();

  let count = 0;
  for (const skillDirName of skillDirNames) {
    count += copySubskillAsReference(skillDirName, outputRoot);
  }

  return count;
}

function collectSkillFiles(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSkillFiles(fullPath, files);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }
}

function collectMarkdownFiles(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
}

function assertSingleWukongSkill(outputRoot) {
  const skillFiles = [];
  collectSkillFiles(outputRoot, skillFiles);
  if (skillFiles.length !== 1 || skillFiles[0] !== path.join(outputRoot, 'SKILL.md')) {
    throw new Error('Wukong skill package must contain exactly one root SKILL.md');
  }
}

function assertWukongFrontmatter(outputRoot) {
  const skillText = readRequiredFile(path.join(outputRoot, 'SKILL.md'));
  const frontmatterMatch = skillText.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Wukong root SKILL.md must start with YAML frontmatter');
  }

  const keys = frontmatterMatch[1].split(/\r?\n/).filter(function(line) {
    return /^[a-zA-Z0-9_-]+:\s*/.test(line);
  }).map(function(line) {
    return line.split(':')[0];
  });

  const invalidKeys = keys.filter(function(key) {
    return key !== 'name' && key !== 'description';
  });
  if (invalidKeys.length > 0) {
    throw new Error('Wukong root SKILL.md frontmatter must only contain name and description');
  }
}

function assertNoSourceSkillLinks(outputRoot) {
  const markdownFiles = [];
  collectMarkdownFiles(outputRoot, markdownFiles);

  for (const markdownFile of markdownFiles) {
    const text = readRequiredFile(markdownFile);
    if (/skills\/[a-z0-9-]+\/SKILL\.md|yida-skills\/SKILL\.md/.test(text)) {
      throw new Error('Generated Wukong package contains source skill path: ' + path.relative(ROOT, markdownFile));
    }
  }
}

function assertGeneratedRootFiles(outputRoot) {
  for (const fileName of ['SKILL.md', 'skills-index.json']) {
    const filePath = path.join(outputRoot, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error('Generated OpenYida skill root missing required file: ' + path.relative(ROOT, filePath));
    }
  }
}

function buildSkillsPackage(outputRoot) {
  if (!fs.existsSync(SOURCE_ROOT)) {
    throw new Error('Missing source skills directory: yida-skills');
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  let count = 0;
  count += writeRootSkill(
    path.join(SOURCE_ROOT, 'SKILL.md'),
    path.join(outputRoot, 'SKILL.md'),
  );
  count += copySkillsIndex(outputRoot);
  count += copyReferencesRecursive(
    path.join(SOURCE_ROOT, 'references'),
    path.join(outputRoot, 'references'),
  );
  count += copySubskillsAsReferences(outputRoot);

  assertSingleWukongSkill(outputRoot);
  assertWukongFrontmatter(outputRoot);
  assertNoSourceSkillLinks(outputRoot);
  assertGeneratedRootFiles(outputRoot);

  return count;
}

function buildZipPackage(outputRoot, zipOut) {
  if (!fs.existsSync(outputRoot)) {
    throw new Error('Missing generated skills package directory: ' + path.relative(ROOT, outputRoot));
  }

  fs.mkdirSync(path.dirname(zipOut), { recursive: true });
  fs.rmSync(zipOut, { force: true });

  const zipBuffer = createZipBuffer(outputRoot, { excludeRootSkillsIndex: true });
  assertZipExcludesRootSkillsIndex(zipBuffer, outputRoot);
  fs.writeFileSync(zipOut, zipBuffer);

  const stat = fs.statSync(zipOut);
  if (!stat.size) {
    throw new Error('Created Wukong zip package is empty: ' + path.relative(ROOT, zipOut));
  }

  return stat.size;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: ((hours << 11) | (minutes << 5) | seconds) & 0xFFFF,
    date: (((year - 1980) << 9) | (month << 5) | day) & 0xFFFF,
  };
}

function collectZipEntries(absPath, entryName, entries) {
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    const dirName = entryName.endsWith('/') ? entryName : entryName + '/';
    entries.push({ absPath, entryName: dirName, stat, isDirectory: true });
    const names = fs.readdirSync(absPath).filter(function(name) {
      return name !== '.DS_Store';
    }).sort();
    for (const name of names) {
      collectZipEntries(path.join(absPath, name), dirName + name, entries);
    }
  } else if (stat.isFile() && path.basename(absPath) !== '.DS_Store') {
    entries.push({ absPath, entryName, stat, isDirectory: false });
  }
}

function writeLocalHeader(entry, nameBuffer, compressed, uncompressed, crc, method) {
  const { time, date } = toDosDateTime(entry.stat.mtime);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(uncompressed.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function writeCentralHeader(entry, nameBuffer, compressed, uncompressed, crc, method, localOffset) {
  const { time, date } = toDosDateTime(entry.stat.mtime);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x031E, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(method, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(date, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(uncompressed.length, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  const unixMode = entry.isDirectory ? 0o40755 : 0o100644;
  const dosAttributes = entry.isDirectory ? 0x10 : 0;
  header.writeUInt32LE(((unixMode << 16) | dosAttributes) >>> 0, 38);
  header.writeUInt32LE(localOffset, 42);
  return header;
}

function isExcludedZipEntry(entry, outputRoot, options) {
  if (!options.excludeRootSkillsIndex || entry.isDirectory) {
    return false;
  }
  const relativePath = path.relative(outputRoot, entry.absPath).split(path.sep).join('/');
  return relativePath === 'skills-index.json';
}

function createZipBuffer(outputRoot, options = {}) {
  const entries = [];
  collectZipEntries(outputRoot, path.basename(outputRoot), entries);
  const zipEntries = entries.filter(function(entry) {
    return !isExcludedZipEntry(entry, outputRoot, options);
  });

  const chunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of zipEntries) {
    const nameBuffer = Buffer.from(entry.entryName.replace(/\\/g, '/'), 'utf8');
    const uncompressed = entry.isDirectory ? Buffer.alloc(0) : fs.readFileSync(entry.absPath);
    const method = entry.isDirectory ? 0 : 8;
    const compressed = entry.isDirectory ? Buffer.alloc(0) : zlib.deflateRawSync(uncompressed);
    const crc = entry.isDirectory ? 0 : crc32(uncompressed);
    const localOffset = offset;

    const localHeader = writeLocalHeader(entry, nameBuffer, compressed, uncompressed, crc, method);
    chunks.push(localHeader, nameBuffer, compressed);
    offset += localHeader.length + nameBuffer.length + compressed.length;

    const centralHeader = writeCentralHeader(entry, nameBuffer, compressed, uncompressed, crc, method, localOffset);
    centralChunks.push(centralHeader, nameBuffer);
  }

  const centralOffset = offset;
  const centralSize = centralChunks.reduce(function(sum, chunk) {
    return sum + chunk.length;
  }, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(zipEntries.length, 8);
  end.writeUInt16LE(zipEntries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat(chunks.concat(centralChunks, end));
}

function findEndOfCentralDirectory(zipBuffer) {
  for (let offset = zipBuffer.length - 22; offset >= 0; offset--) {
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('Invalid zip package: missing end of central directory');
}

function listZipEntryNames(zipBuffer) {
  const endOffset = findEndOfCentralDirectory(zipBuffer);
  const entryCount = zipBuffer.readUInt16LE(endOffset + 10);
  let offset = zipBuffer.readUInt32LE(endOffset + 16);
  const names = [];

  for (let index = 0; index < entryCount; index++) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid zip package: malformed central directory');
    }

    const nameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    names.push(zipBuffer.slice(nameStart, nameEnd).toString('utf8'));
    offset = nameEnd + extraLength + commentLength;
  }

  return names;
}

function assertZipExcludesRootSkillsIndex(zipBuffer, outputRoot) {
  const rootIndexEntryName = path.basename(outputRoot).replace(/\\/g, '/') + '/skills-index.json';
  const names = listZipEntryNames(zipBuffer);
  if (names.includes(rootIndexEntryName)) {
    throw new Error('Wukong upload zip must not include root skills-index.json: ' + rootIndexEntryName);
  }
}

function formatBytes(size) {
  if (size < 1024) {return size + ' B';}
  if (size < 1024 * 1024) {return (size / 1024).toFixed(1) + ' KB';}
  return (size / 1024 / 1024).toFixed(1) + ' MB';
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const count = buildSkillsPackage(options.out);
  console.log('Built OpenYida skills package: ' + path.relative(ROOT, options.out));
  console.log('Files copied: ' + count);
  if (options.zip) {
    const zipSize = buildZipPackage(options.out, options.zipOut);
    console.log('Built Wukong upload zip: ' + path.relative(ROOT, options.zipOut) + ' (' + formatBytes(zipSize) + ')');
  }
}

run();
