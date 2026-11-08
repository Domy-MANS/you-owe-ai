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

  /** Random access to the input: a File/Blob is read in slices, so a 500 MB export full of images never sits in memory. */
  function source(input) {
    if (typeof Blob !== "undefined" && input instanceof Blob) return {
      size: input.size,
      read: async function (a, b) { return new Uint8Array(await input.slice(a, b).arrayBuffer()); },
    };
    var u8 = new Uint8Array(input.buffer ? input.buffer : input, input.byteOffset || 0, input.byteLength);
    return { size: u8.length, read: async function (a, b) { return u8.subarray(a, b); } };
  }
  function view(u8) { return new DataView(u8.buffer, u8.byteOffset, u8.byteLength); }

  /** Returns [{ name, read: async () => Uint8Array }] for every file in the zip. */
  async function listZip(input) {
    var src = input && typeof input.read === "function" && "size" in input ? input : source(input);
    var tailStart = Math.max(0, src.size - 65557), tail = await src.read(tailStart, src.size), tv = view(tail);
    var eocd = -1;
    for (var i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not a zip file");
    var count = tv.getUint16(eocd + 10, true), cdSize = tv.getUint32(eocd + 12, true), cdOff = tv.getUint32(eocd + 16, true);
    var cd = await src.read(cdOff, cdOff + cdSize), dv = view(cd), off = 0, out = [];
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (off + 46 > cd.length || dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
      var nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      var local = dv.getUint32(off + 42, true), name = dec.decode(cd.subarray(off + 46, off + 46 + nlen));
      (function (method, csize, local, name) {
        out.push({ name: name, read: async function () {
          var h = view(await src.read(local, local + 30));
          var start = local + 30 + h.getUint16(26, true) + h.getUint16(28, true);
          var data = await src.read(start, start + csize);
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
          out.prompts.push({ ts: ts, tool: "chatgpt", c: s.id });
          if (text.trim()) out.texts.push({ ts: ts, text: text, c: s.id }); // images count as prompts, not as catchphrases
        } else if (m.author.role === "assistant") {
          touch(s, ts);
          if (meta.model_slug) s.models[meta.model_slug] = (s.models[meta.model_slug] || 0) + 1;
          if (text) out.replies.push({ ts: ts, text: text, c: s.id });
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
          out.prompts.push({ ts: ts, tool: "claudeai", c: s.id });
          if (text.trim()) out.texts.push({ ts: ts, text: text, c: s.id });
        } else if (m.sender === "assistant" && text) out.replies.push({ ts: ts, text: text, c: s.id });
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

  /** A ChatGPT or Claude.ai export: the .zip, or the conversations JSON. Accepts a File/Blob or bytes. */
  async function readExport(input) {
    var src = source(input), head = await src.read(0, 2), convs;
    var parse = function (bytes) { try { return JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw fail("not-json", "not a JSON file"); } };
    if (head[0] === 0x50 && head[1] === 0x4b) {
      var files = await listZip(src), names = files.map(function (e) { return e.name; }).join("\n");
      // conversations.json, or (newer ChatGPT exports) conversations-000.json, conversations-001.json, ...
      var parts = files.filter(function (e) { return /(^|\/)conversations(-\d+)?\.json$/.test(e.name); })
        .sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      if (!parts.length) {
        // Claude's export comes as several zips; point people at the right one
        if (/(^|\/)(users|login_history)\.json$/m.test(names)) throw fail("claude-metadata", "this is Claude's account file (light_metadata)");
        if (/memor/i.test(names)) throw fail("claude-memories", "this is Claude's memories file");
        if (/frame/i.test(names)) throw fail("claude-frames", "this is Claude's frames file");
        throw fail("no-conversations", "no conversations.json in this zip");
      }
      convs = [];
      for (var i = 0; i < parts.length; i++) {
        var one = parse(await parts[i].read());
        if (!Array.isArray(one)) { convs = one; break; }
        convs = convs.concat(one);
      }
    } else convs = parse(await src.read(0, src.size));
    if (convs && !Array.isArray(convs) && Array.isArray(convs.data_files)) throw fail("claude-manifest", "this is Claude's export manifest, not the chats");
    var kind = detect(convs);
    if (kind === "chatgpt") return Object.assign({ kind: kind }, parseChatGPT(convs));
    if (kind === "claudeai") return Object.assign({ kind: kind }, parseClaudeAI(convs));
    throw fail("unknown", "this doesn't look like a ChatGPT or Claude export");
  }

  /**
   * Several imports as one, each conversation counted once: the same export twice, or an older
   * and a newer export of the same account, don't add up. When a conversation shows up again,
   * the copy with more messages (the newer export) wins. `kind` keeps one source only.
   */
  function merge(list, kind) {
    var by = {}, order = [];
    (list || []).forEach(function (w) {
      if (!w || (kind && w.kind !== kind)) return;
      var tool = w.kind, items = {};
      var bucket = function (id) { return items[id] || (items[id] = { session: null, prompts: [], texts: [], replies: [] }); };
      w.sessions.forEach(function (s) { bucket(s.id).session = s; });
      ["prompts", "texts", "replies"].forEach(function (f) { (w[f] || []).forEach(function (x) { bucket(x.c)[f].push(x); }); });
      Object.keys(items).forEach(function (id) {
        var k = tool + ":" + id, it = items[id];
        if (!by[k]) order.push(k);
        if (!by[k] || it.prompts.length + it.replies.length >= by[k].prompts.length + by[k].replies.length) by[k] = it;
      });
    });
    var out = { sessions: [], prompts: [], texts: [], replies: [] };
    order.forEach(function (k) {
      var it = by[k];
      if (it.session) out.sessions.push(it.session);
      out.prompts = out.prompts.concat(it.prompts); out.texts = out.texts.concat(it.texts); out.replies = out.replies.concat(it.replies);
    });
    return out;
  }

  var api = { merge: merge, listZip: listZip, parseChatGPT: parseChatGPT, parseClaudeAI: parseClaudeAI, detect: detect, readExport: readExport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VWWebChat = api;
})(typeof self !== "undefined" ? self : this);
