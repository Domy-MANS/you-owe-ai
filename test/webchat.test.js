const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../src/core/webchat");
const { computeStats } = require("../src/core/stats");

const { makeZip } = require("./helpers/zip");

const t = (iso) => Date.parse(iso) / 1000;
const chatgpt = [{
  id: "c1", title: "secret title", create_time: t("2026-03-01T10:00:00Z"),
  mapping: {
    root: { message: null },
    sys: { message: { author: { role: "system" }, create_time: t("2026-03-01T10:00:00Z"), content: { parts: ["you are helpful"] }, metadata: { is_visually_hidden_from_conversation: true } } },
    u1: { message: { author: { role: "user" }, create_time: t("2026-03-01T10:00:01Z"), content: { parts: ["不对，为什么？？"] }, metadata: {} } },
    a1: { message: { author: { role: "assistant" }, create_time: t("2026-03-01T10:00:05Z"), content: { parts: ["Sorry! You're right."] }, metadata: { model_slug: "gpt-5" } } },
    u2: { message: { author: { role: "user" }, create_time: t("2026-03-01T23:30:00Z"), content: { parts: ["thanks", { image: 1 }] }, metadata: {} } },
  },
}];
const claudeai = [{
  uuid: "x1", name: "secret", created_at: "2026-04-02T09:00:00Z",
  chat_messages: [
    { sender: "human", created_at: "2026-04-02T09:00:00Z", text: "然后呢" },
    { sender: "assistant", created_at: "2026-04-02T09:00:04Z", text: "", content: [{ type: "text", text: "Done ✅" }] },
    { sender: "human", created_at: "2026-04-02T09:01:00Z", text: "然后呢" },
  ],
}];

test("reads a ChatGPT export zip", async () => {
  const zip = makeZip({ "user.json": "{}", "conversations.json": JSON.stringify(chatgpt), "chat.html": "<html>" });
  const r = await W.readExport(zip);
  assert.equal(r.kind, "chatgpt");
  assert.equal(r.prompts.length, 2); // hidden system message skipped
  assert.deepEqual(r.texts.map((x) => x.text), ["不对，为什么？？", "thanks"]);
  assert.equal(r.replies[0].text, "Sorry! You're right.");
  assert.equal(r.sessions[0].models["gpt-5"], 1);
  assert.equal(r.sessions[0].project, ""); // titles never used
});

test("reads a Claude.ai export (zip or bare json)", async () => {
  const r = await W.readExport(makeZip({ "conversations.json": JSON.stringify(claudeai), "users.json": "[]" }));
  assert.equal(r.kind, "claudeai");
  assert.equal(r.prompts.length, 2);
  assert.equal(r.replies[0].text, "Done ✅");
  const bare = await W.readExport(Buffer.from(JSON.stringify(claudeai)));
  assert.equal(bare.prompts.length, 2);
});

test("rejects things that aren't exports", async () => {
  await assert.rejects(W.readExport(makeZip({ "notes.txt": "hi" })), /no conversations\.json/);
  await assert.rejects(W.readExport(Buffer.from('[{"foo":1}]')), /doesn't look like/);
});

test("web chats merge into the stats as their own sources", async () => {
  const g = await W.readExport(makeZip({ "conversations.json": JSON.stringify(chatgpt) }));
  const c = await W.readExport(Buffer.from(JSON.stringify(claudeai)));
  const st = computeStats({ sessions: [...g.sessions, ...c.sessions], prompts: [...g.prompts, ...c.prompts] }, { year: 2026 });
  assert.equal(st.prompts, 4);
  assert.equal(st.byTool.chatgpt.prompts, 2);
  assert.equal(st.byTool.claudeai.prompts, 2);
  assert.equal(st.byTool.claude.prompts, 0);
  assert.equal(st.sessions, 2);
});
