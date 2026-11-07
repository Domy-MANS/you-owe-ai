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

module.exports = { makeZip, chatgptExport };
