/**
 * ChatGPT and Claude.ai data exports (Settings → Export data → a .zip by email).
 * Runs in Node and the browser. Reads only timestamps, roles, model names and
 * message text (for the roast counts); conversation titles are ignored.
 */
(function (root) {
  "use strict";
  var P = typeof module !== "undefined" && module.exports ? require("./parse") : root.VWParse;

  // ---------- minimal ZIP reader (stored + deflate), no dependencies ----------
  async function inflateRaw(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Returns [{ name, read: async () => Uint8Array }] for every file in the zip. */
  function listZip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not a zip file");
    var count = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), out = [];
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
      var nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      var local = dv.getUint32(off + 42, true), name = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
      (function (method, csize, local, name) {
        out.push({ name: name, read: async function () {
          var start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
          var data = u8.subarray(start, start + csize);
          if (method === 0) return data;
          if (method === 8) return inflateRaw(data);
          throw new Error("unsupported zip compression " + method);
        } });
      })(method, csize, local, name);
      off += 46 + nlen + xlen + clen;
    }
    return out;
  }

  // ---------- the two export formats ----------
  function textOf(parts) {
    return (parts || []).filter(function (x) { return typeof x === "string"; }).join("\n");
  }

  /** ChatGPT conversations.json: [{ id, create_time, mapping: { node: { message } } }] */
  function parseChatGPT(convs) {
    var out = { sessions: [], prompts: [], texts: [], replies: [] };
    convs.forEach(function (c) {
      var s = P.newSession("chatgpt", c.id || c.conversation_id || String(c.create_time));
      Object.keys(c.mapping || {}).forEach(function (k) {
        var m = c.mapping[k] && c.mapping[k].message;
        if (!m || !m.author) return;
        var ts = (m.create_time || c.create_time || 0) * 1000;
        if (!ts) return;
        var meta = m.metadata || {}, text = m.content ? textOf(m.content.parts) || m.content.text || "" : "";
        var media = m.content && (m.content.parts || []).some(function (x) { return x && typeof x === "object"; });
        if (m.author.role === "user" && !meta.is_visually_hidden_from_conversation && (text.trim() || media)) {
          s.prompts++; touch(s, ts);
          out.prompts.push({ ts: ts, tool: "chatgpt" });
          if (text.trim()) out.texts.push({ ts: ts, text: text }); // images count as prompts, not as catchphrases
        } else if (m.author.role === "assistant") {
          touch(s, ts);
          if (meta.model_slug) s.models[meta.model_slug] = (s.models[meta.model_slug] || 0) + 1;
          if (text) out.replies.push({ ts: ts, text: text });
        }
      });
      if (s.start !== null) out.sessions.push(s);
    });
    return out;
  }

  /** Claude.ai conversations.json: [{ uuid, chat_messages: [{ sender, text, content, created_at }] }] */
  function parseClaudeAI(convs) {
    var out = { sessions: [], prompts: [], texts: [], replies: [] };
    convs.forEach(function (c) {
      var s = P.newSession("claudeai", c.uuid || c.created_at);
      (c.chat_messages || []).forEach(function (m) {
        var ts = Date.parse(m.created_at || c.created_at);
        if (isNaN(ts)) return;
        var text = m.text || (m.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("\n");
        touch(s, ts);
        var media = (m.attachments && m.attachments.length) || (m.files && m.files.length) ||
          (m.content || []).some(function (b) { return b.type === "image" || b.type === "document"; });
        if (m.sender === "human" && (text.trim() || media)) {
          s.prompts++;
          out.prompts.push({ ts: ts, tool: "claudeai" });
          if (text.trim()) out.texts.push({ ts: ts, text: text });
        } else if (m.sender === "assistant" && text) out.replies.push({ ts: ts, text: text });
      });
      if (s.start !== null) out.sessions.push(s);
    });
    return out;
  }

  function touch(s, t) {
    if (s.start === null || t < s.start) s.start = t;
    if (s.end === null || t > s.end) s.end = t;
  }

  /** Which export is this conversations.json? */
  function detect(convs) {
    if (!Array.isArray(convs) || !convs.length) return null;
    var c = convs.find(function (x) { return x && (x.mapping || x.chat_messages); }) || convs[0];
    return c.mapping ? "chatgpt" : c.chat_messages ? "claudeai" : null;
  }

  /** Accepts the export .zip or its conversations.json (as bytes). */
  function fail(code, msg) { var e = new Error(msg); e.code = code; return e; }

  async function readExport(bytes) {
    var u8 = new Uint8Array(bytes), json;
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      var files = listZip(u8), names = files.map(function (e) { return e.name; }).join("\n");
      var entry = files.find(function (e) { return /(^|\/)conversations\.json$/.test(e.name); });
      if (!entry) {
        // Claude's export comes as several zips; point people at the right one
        if (/(^|\/)(users|login_history)\.json$/m.test(names)) throw fail("claude-metadata", "this is Claude's account file (light_metadata)");
        if (/memor/i.test(names)) throw fail("claude-memories", "this is Claude's memories file");
        if (/frame/i.test(names)) throw fail("claude-frames", "this is Claude's frames file");
        throw fail("no-conversations", "no conversations.json in this zip");
      }
      json = new TextDecoder().decode(await entry.read());
    } else json = new TextDecoder().decode(u8);
    var convs;
    try { convs = JSON.parse(json); } catch (e) { throw fail("not-json", "not a JSON file"); }
    if (convs && !Array.isArray(convs) && Array.isArray(convs.data_files)) throw fail("claude-manifest", "this is Claude's export manifest, not the chats");
    var kind = detect(convs);
    if (kind === "chatgpt") return Object.assign({ kind: kind }, parseChatGPT(convs));
    if (kind === "claudeai") return Object.assign({ kind: kind }, parseClaudeAI(convs));
    throw fail("unknown", "this doesn't look like a ChatGPT or Claude export");
  }

  var api = { listZip: listZip, parseChatGPT: parseChatGPT, parseClaudeAI: parseClaudeAI, detect: detect, readExport: readExport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VWWebChat = api;
})(typeof self !== "undefined" ? self : this);
