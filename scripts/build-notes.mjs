// Builds the Notes section of the site from an Obsidian vault copy.
//
//   content/notes/   the vault, copied as is (minus .obsidian)
//   notes/           generated HTML: one listing page per folder, one page per note
//
// Folders that hold no notes (e.g. attachment folders) are not listed.
// Rendering follows Obsidian's reading view defaults: soft line breaks shown,
// bare URLs linked, ==highlights==, ![[embeds]], [[links]], $math$, highlighted code.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import markPlugin from "markdown-it-mark";
import texmath from "markdown-it-texmath";
import katex from "katex";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "notes");
const OUT = path.join(ROOT, "notes");
const SITE_TITLE = "NonEuclideanSpace";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"]);
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

// ---------- vault scan ----------

const isHidden = (name) => name.startsWith(".");

function scan(dir, rel = "") {
  const node = { name: path.basename(dir), rel, folders: [], notes: [], files: [] };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isHidden(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) node.folders.push(scan(abs, childRel));
    else if (entry.name.toLowerCase().endsWith(".md")) node.notes.push({ name: entry.name.slice(0, -3), rel: childRel, abs });
    else node.files.push({ name: entry.name, rel: childRel, abs });
  }
  node.folders.sort((a, b) => collator.compare(a.name, b.name));
  node.notes.sort((a, b) => collator.compare(a.name, b.name));
  return node;
}

const hasNotes = (node) => node.notes.length > 0 || node.folders.some(hasNotes);

// ---------- URLs ----------

function slug(segment) {
  return segment
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[?#%\\/:*"<>|'`^{}\[\]()!,;=+&$@~]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

const slugPath = (rel) => rel.split("/").map(slug).join("/");
const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

function noteUrl(note) {
  return `/notes/${encodePath(slugPath(note.rel.slice(0, -3)))}/`;
}
function folderUrl(folder) {
  return folder.rel ? `/notes/${encodePath(slugPath(folder.rel))}/` : "/notes/";
}
function fileUrl(file) {
  const dir = path.posix.dirname(file.rel);
  const ext = path.extname(file.name).toLowerCase();
  const base = slug(path.basename(file.name, path.extname(file.name))) + ext;
  return `/notes/${dir === "." ? "" : encodePath(slugPath(dir)) + "/"}${encodeURIComponent(base)}`;
}

// ---------- link resolution (Obsidian: by name, anywhere in the vault) ----------

const tree = scan(SRC);
const allNotes = [];
const allFiles = [];
(function collect(node) {
  allNotes.push(...node.notes);
  allFiles.push(...node.files);
  node.folders.forEach(collect);
})(tree);

function resolve(target, list, fromRel) {
  const t = target.normalize("NFC").replace(/\\/g, "/");
  const byPath = list.find((x) => x.rel === t || x.rel === `${t}.md`);
  if (byPath) return byPath;
  const base = path.posix.basename(t);
  const matches = list.filter((x) => x.name === base || x.name === `${base}`.replace(/\.md$/i, ""));
  if (matches.length <= 1) return matches[0];
  // Prefer the one closest to the linking note.
  const fromDir = path.posix.dirname(fromRel);
  return matches.find((x) => path.posix.dirname(x.rel) === fromDir) ?? matches[0];
}

// ---------- markdown ----------

loadLanguages(["bash", "python", "javascript", "typescript", "json", "yaml", "c", "cpp", "java", "latex", "markdown", "sql", "rust", "go"]);

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LANG_ALIAS = { sh: "bash", shell: "bash", zsh: "bash", console: "bash", py: "python", js: "javascript", ts: "typescript", yml: "yaml", tex: "latex", md: "markdown" };

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  highlight(code, lang) {
    const name = LANG_ALIAS[lang] ?? lang;
    const grammar = name && Prism.languages[name];
    const body = grammar ? Prism.highlight(code, grammar, name) : escapeHtml(code);
    return `<pre class="code" data-lang="${escapeHtml(lang || "")}"><code>${body}</code></pre>`;
  },
});
md.use(markPlugin);
md.use(texmath, { engine: katex, delimiters: "dollars", katexOptions: { throwOnError: false, output: "html" } });

// Obsidian wiki links and embeds: [[target|label]] and ![[target|size]]
md.inline.ruler.before("link", "wikilink", (state, silent) => {
  const src = state.src;
  let pos = state.pos;
  const embed = src.charCodeAt(pos) === 0x21 /* ! */;
  if (embed) pos++;
  if (src.slice(pos, pos + 2) !== "[[") return false;
  const end = src.indexOf("]]", pos + 2);
  if (end < 0) return false;
  const inner = src.slice(pos + 2, end);
  if (!inner || inner.includes("\n")) return false;
  if (!silent) {
    const [rawTarget, ...rest] = inner.split("|");
    const tok = state.push("wikilink", "", 0);
    tok.meta = { embed, target: rawTarget.trim(), label: rest.join("|").trim() };
  }
  state.pos = end + 2;
  return true;
});

md.renderer.rules.wikilink = (tokens, idx, _opts, env) => {
  const { embed, target, label } = tokens[idx].meta;
  const [file, heading] = target.split("#");
  const ext = path.extname(file).toLowerCase();
  if (embed && IMAGE_EXT.has(ext)) {
    const hit = resolve(file, allFiles, env.rel);
    if (!hit) return `<span class="missing">${escapeHtml(target)}</span>`;
    const [w, h] = /^\d+(x\d+)?$/.test(label) ? label.split("x") : [];
    const size = w ? ` width="${w}"${h ? ` height="${h}"` : ""}` : "";
    return `<img src="${fileUrl(hit)}" alt="${escapeHtml(w ? file : label || file)}"${size} loading="lazy">`;
  }
  const hit = resolve(file, allNotes, env.rel);
  const text = escapeHtml(label || (heading && !file ? heading : target.replace(/#/g, " > ")));
  if (!hit && !file) return `<a href="#${encodeURIComponent(slug(heading))}">${text}</a>`;
  if (!hit) return `<span class="missing">${text}</span>`;
  return `<a href="${noteUrl(hit)}${heading ? "#" + encodeURIComponent(slug(heading)) : ""}">${text}</a>`;
};

// Relative markdown images/links: resolve against the note's folder.
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, opts, env, self) => {
  const tok = tokens[idx];
  const src = tok.attrGet("src");
  if (src && !/^[a-z]+:|^\//i.test(src)) {
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(env.rel), decodeURIComponent(src)));
    const hit = allFiles.find((f) => f.rel === rel) ?? resolve(path.posix.basename(rel), allFiles, env.rel);
    if (hit) tok.attrSet("src", fileUrl(hit));
  }
  tok.attrSet("loading", "lazy");
  return defaultImage(tokens, idx, opts, env, self);
};

// Heading ids, so [[Note#Heading]] can land.
md.renderer.rules.heading_open = (tokens, idx, opts, _env, self) => {
  const text = tokens[idx + 1]?.children?.map((t) => t.content).join("") ?? "";
  tokens[idx].attrSet("id", slug(text));
  return self.renderToken(tokens, idx, opts);
};

function stripFrontmatter(src) {
  return src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}
function stripComments(src) {
  // Obsidian %%comments%% are not shown in reading view.
  return src.replace(/%%[\s\S]*?%%/g, "");
}

// ---------- pages ----------

function crumbs(trail) {
  const parts = [`<a href="/">Home</a>`, ...trail.map((t) => `<a href="${t.url}">${escapeHtml(t.name)}</a>`)];
  return `<header class="site-header"><nav class="crumbs" aria-label="Breadcrumb">${parts.join('<span aria-hidden="true">/</span>')}</nav></header>`;
}

function page({ title, trail, body, math }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${SITE_TITLE}</title>
  <meta name="theme-color" content="#FFFFFF">
  <link rel="preload" href="/assets/fonts/hanken-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="stylesheet" href="/assets/css/notes.css">${math ? '\n  <link rel="stylesheet" href="/assets/katex/katex.min.css">' : ""}
</head>
<body>
  ${crumbs(trail)}
  <main class="page">
${body}
  </main>
</body>
</html>
`;
}

function listing(folder, trail) {
  const items = [
    ...folder.folders.filter(hasNotes).map((f) => `<li><a href="${folderUrl(f)}">${escapeHtml(f.name)}</a></li>`),
    ...folder.notes.map((n) => `<li><a href="${noteUrl(n)}">${escapeHtml(n.name)}</a></li>`),
  ];
  const title = folder.rel ? folder.name : "Notes";
  const body = `    <h1>${escapeHtml(title)}</h1>\n    <ul class="listing">\n      ${items.join("\n      ")}\n    </ul>`;
  return page({ title, trail, body });
}

function write(urlPath, html) {
  const file = path.join(OUT, decodeURIComponent(urlPath.replace(/^\/notes\/?/, "")), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

fs.rmSync(OUT, { recursive: true, force: true });

(function build(folder, trail) {
  if (!hasNotes(folder) && folder.rel) return;
  const here = folder.rel ? [...trail] : [];
  write(folderUrl(folder), listing(folder, here));
  const childTrail = [...trail, { name: folder.rel ? folder.name : "Notes", url: folderUrl(folder) }];

  for (const note of folder.notes) {
    const src = stripComments(stripFrontmatter(fs.readFileSync(note.abs, "utf8")));
    const html = md.render(src, { rel: note.rel });
    const body = `    <article class="note">\n      <h1 class="note-title">${escapeHtml(note.name)}</h1>\n${html}    </article>`;
    write(noteUrl(note), page({ title: note.name, trail: childTrail, body, math: html.includes('class="katex') }));
  }
  for (const file of folder.files) {
    const dest = path.join(OUT, decodeURIComponent(fileUrl(file).replace(/^\/notes\//, "")));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file.abs, dest);
  }
  folder.folders.forEach((f) => build(f, childTrail));
})(tree, []);

// Attachments inside folders without notes are still needed by embeds.
for (const file of allFiles) {
  const dest = path.join(OUT, decodeURIComponent(fileUrl(file).replace(/^\/notes\//, "")));
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file.abs, dest);
  }
}

// KaTeX stylesheet and fonts, self-hosted so math renders without a CDN.
const KATEX = path.join(ROOT, "node_modules", "katex", "dist");
const KATEX_OUT = path.join(ROOT, "assets", "katex");
fs.rmSync(KATEX_OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(KATEX_OUT, "fonts"), { recursive: true });
fs.copyFileSync(path.join(KATEX, "katex.min.css"), path.join(KATEX_OUT, "katex.min.css"));
for (const f of fs.readdirSync(path.join(KATEX, "fonts")).filter((f) => f.endsWith(".woff2"))) {
  fs.copyFileSync(path.join(KATEX, "fonts", f), path.join(KATEX_OUT, "fonts", f));
}

console.log(`notes: ${allNotes.length}, attachments: ${allFiles.length}`);
