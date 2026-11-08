<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/logo-dark.svg" />
    <img src="docs/img/logo-light.svg" width="560" alt="You Owe AI" />
  </picture>
</p>

# You Owe AI: your AI just sent you an invoice

**English** | [简体中文](README.zh-CN.md)

A year of Claude Code, Codex, ChatGPT and Claude.ai, itemized and billed back to you. Every time you told the AI it was wrong is an emotional damages charge, every repeated catchphrase is noise pollution, every prompt after 10pm is night-shift pay, and every "thanks" is a discount. The bill comes with a client review, your client file and credit rating, and an IOU you can share. It runs entirely in your browser.

[![The cover of the invoice, the noise pollution charge for your catchphrases, and your client file](docs/img/hero-en.png)](https://domy-mans.github.io/you-owe-ai/)

▶ [Get your invoice](https://domy-mans.github.io/you-owe-ai/)

## How it works

1. **On a computer**, open the page and choose your `.claude` and `.codex` folders. Clicking the button copies the path for you: in the file window, press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd>, <kbd>⌘</kbd> <kbd>V</kbd>, <kbd>Enter</kbd>, then **Select**. **On a phone**, import your ChatGPT or Claude.ai chat export instead.
2. Your browser reads everything, counts it, and prints the invoice line by line.
3. Tap through the pages. On the last one, download the IOU as an image or copy a share link.

Anyone who opens your share link sees your whole invoice, with a button to make their own. The numbers travel inside the link itself, so no server ever stores them.

## The invoice

![Item 1 emotional damages, the client review, and the shareable IOU](docs/img/bill-en.png)

| Page | What's on it |
|---|---|
| Invoice | The amount due, with a PAST DUE stamp |
| Item 1: Emotional damages | Times you told AI it was wrong, AI apologies, and a discount for every "thanks" |
| Item 2: Noise pollution | Your most repeated prompts, billed per repeat |
| Item 3: Night shifts and injuries | Prompts after 10pm, your angriest day, and your latest prompt |
| Item 4: Wages and supplies | Hours AI worked for you at minimum wage, GPU wear per million tokens |
| Attendance record | When you clock in, and what you mostly make AI do |
| Client review | Your AI employee rates you, one to five stars |
| Client file | Your persona (Cyber Overlord, The Client From Hell, Human Broken Record and more), credit rating and hidden traits |
| You vs them | When a friend's link is involved: your bill next to theirs, and a verdict |
| IOU | A 1080 × 1350 receipt with every charge and a QR code back to the site, ready to post |

Rates are in US dollars at the federal minimum wage. The Chinese version bills in yuan at McDonald's hourly pay.

## The web AI calls you

![The incoming call, the call screen where the web AI asks for your chat export, and the missed-call button left after you hang up](docs/img/call-en.png)

A few seconds into your invoice, the AI you chat with on the web calls to collect on those chats too. Answer, and it walks you through exporting your data from ChatGPT or Claude.ai. Drop the zip in, and your web conversations are added to the bill. Hang up and a phone button stays in the corner, so you can finish reading and call back later. You can also import an export from the home page. Claude's export arrives as several files: the one you need is `conversations-000.zip`. On a phone, this is the way in: phones can't open the `.claude` and `.codex` folders, but they can import a chat export.

## Compare with a friend

![A friend's shared invoice, the phone home page, and the bill comparison](docs/img/friends-en.png)

Open a friend's share link, tap **Make my own**, and your bill ends with a page that puts the two side by side: the amount due, how often each of you told AI it was wrong or said thanks, your top catchphrases and personas, and who's the worse boss. On a phone, **Send to my computer** carries your friend along, so the comparison still shows up when you make your bill on your computer.

Already made yours? Then send your link back. Your browser remembers your own bill, so when you open their link the comparison page is already there, with no folders to pick again.

## Privacy

- **Nothing leaves your computer.** The page ships with a Content-Security-Policy that blocks every network request, and the browser enforces it. Open the Network tab in DevTools to check.
- **Only counts are kept.** To find catchphrases and moods, prompt text is scanned in your browser. The report keeps counts and short repeated phrases, never your conversations.
- **The IOU shows numbers only.** No project names, no conversation titles.
- **Share links leave out** project names and day-by-day history. They hold the numbers and catchphrases the pages show.
- **For comparisons**, your browser keeps the bill of the friend you came from for two weeks, and your own bill's numbers for a month. Both stay in your browser and hold the same numbers as a share link.

## Where are the folders?

| System | Claude Code | Codex |
|---|---|---|
| macOS, Linux | `~/.claude` | `~/.codex` |
| Windows | `%USERPROFILE%\.claude` | `%USERPROFILE%\.codex` |

Both folders are hidden. On macOS, press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd> in the file window and paste the path. Claude Code deletes detailed session logs after about 30 days, so older months come from its prompt history and count prompts only.

## Command line

```bash
npx github:Domy-MANS/you-owe-ai
```

This reads both folders directly, writes the invoice to an HTML file and opens it.

| Option | What it does |
|---|---|
| `--import <file>` | Add a ChatGPT or Claude.ai export (`.zip` or `conversations.json`). Can be repeated. |
| `--year <yyyy>` | Bill a different year |
| `--demo` | Preview with made-up data |
| `--hide-projects` | Leave project names out |
| `--no-text` | Don't scan prompt text, which skips catchphrases and the review |
| `--json` | Print the raw numbers |
| `--out <file>`, `--no-open` | Choose the output file, and don't open the browser |

## Repository layout

```text
src/core/    Log parsing, stats, the roast and export import (shared by the web page and the CLI)
src/page/    The invoice: slides, share card, share links
web/         The home page, folder picker and incoming call
bin/         The command line
docs/        The built web page (GitHub Pages) and README images
test/        Unit tests: node --test test/
e2e/         Browser tests in real Chrome at phone sizes: npm run test:e2e
```

## License

MIT
