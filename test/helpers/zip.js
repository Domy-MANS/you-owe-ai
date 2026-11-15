// Build a real .zip (deflate) in memory, like the export emails. Shared by unit and browser tests.
const zlib = require("node:zlib");

function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name), raw = Buffer.from(text), comp = zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, comp);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22), n = Object.keys(files).length;
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(n, 8); eocd.writeUInt16LE(n, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/** The same zip written the ZIP64 way, as zip tools do past 4 GB or 65,535 files: sizes and offsets live in 8-byte fields. */
function makeZip64(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name), raw = Buffer.from(text), comp = zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(45, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const junk = Buffer.from([0x55, 0x54, 1, 0, 0]); // another extra field first, to be skipped
    const x = Buffer.alloc(4 + 24);
    x.writeUInt16LE(1, 0); x.writeUInt16LE(24, 2); x.writeBigUInt64LE(BigInt(raw.length), 4); x.writeBigUInt64LE(BigInt(comp.length), 12); x.writeBigUInt64LE(BigInt(offset), 20);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(45, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(0xffffffff, 20); ch.writeUInt32LE(0xffffffff, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(junk.length + x.length, 30); ch.writeUInt32LE(0xffffffff, 42);
    locals.push(lh, nameBuf, comp);
    centrals.push(ch, nameBuf, junk, x);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals), n = Object.keys(files).length;
  const z = Buffer.alloc(56);
  z.writeUInt32LE(0x06064b50, 0); z.writeBigUInt64LE(44n, 4); z.writeUInt16LE(45, 12); z.writeUInt16LE(45, 14);
  z.writeBigUInt64LE(BigInt(n), 24); z.writeBigUInt64LE(BigInt(n), 32); z.writeBigUInt64LE(BigInt(cd.length), 40); z.writeBigUInt64LE(BigInt(offset), 48);
  const loc = Buffer.alloc(20);
  loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(offset + cd.length), 8); loc.writeUInt32LE(1, 16);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0xffff, 8); eocd.writeUInt16LE(0xffff, 10);
  eocd.writeUInt32LE(0xffffffff, 12); eocd.writeUInt32LE(0xffffffff, 16);
  return Buffer.concat([...locals, cd, z, loc, eocd]);
}

/** A fake ChatGPT export with `count` conversations. */
function chatgptExport(count = 40) {
  const base = Date.parse("2026-06-01T10:00:00Z") / 1000, says = ["不对", "还是不行", "谢谢", "为什么？？", "然后呢", "why is this wrong"];
  const convs = [];
  for (let i = 0; i < count; i++) {
    const mapping = {};
    for (let j = 0; j < 4; j++) {
      const ts = base + i * 86400 + j * 60;
      mapping["u" + j] = { message: { author: { role: "user" }, create_time: ts, content: { parts: [says[(i + j) % says.length]] }, metadata: {} } };
      mapping["a" + j] = { message: { author: { role: "assistant" }, create_time: ts + 5, content: { parts: ["Sorry, done."] }, metadata: { model_slug: "gpt-5" } } };
    }
    convs.push({ id: "c" + i, title: "t", create_time: base + i * 86400, mapping });
  }
  return makeZip({ "conversations.json": JSON.stringify(convs), "user.json": "{}" });
}

module.exports = { makeZip, makeZip64, chatgptExport };
