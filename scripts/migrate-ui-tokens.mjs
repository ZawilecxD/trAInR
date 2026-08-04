#!/usr/bin/env node
/**
 * One-shot migration: replace hardcoded cosmic/purple palette classes with DESIGN.md tokens.
 * Run: node scripts/migrate-ui-tokens.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");

const REPLACEMENTS = [
  // Page backgrounds
  ["bg-cosmic", "bg-background"],
  // Borders
  ["border-white/20", "border-border"],
  ["border-white/15", "border-border"],
  ["border-white/10", "border-border"],
  // Surfaces
  ["bg-white/5", "bg-card"],
  ["hover:bg-white/20", "hover:bg-accent"],
  ["hover:bg-white/10", "hover:bg-accent"],
  ["bg-white/15", "bg-accent"],
  ["bg-white/10", "bg-muted"],
  // Text — most specific first
  ["text-blue-100/80", "text-muted-foreground"],
  ["text-blue-100/70", "text-muted-foreground"],
  ["text-blue-100/60", "text-muted-foreground"],
  ["text-blue-100/50", "text-muted-foreground"],
  ["text-blue-200/80", "text-text-soft"],
  ["text-blue-100", "text-foreground"],
  ["text-blue-200", "text-text-soft"],
  // Primary actions
  ["hover:bg-purple-500/90", "hover:bg-primary/90"],
  ["hover:bg-purple-500", "hover:bg-primary/90"],
  ["bg-purple-600", "bg-primary"],
  ["bg-purple-500/30", "bg-primary/30"],
  ["bg-purple-500/20", "bg-primary/20"],
  ["bg-purple-500", "bg-primary"],
  ["text-purple-300", "text-text-lavender"],
  ["hover:text-purple-200", "hover:text-text-lavender"],
  ["text-purple-200", "text-text-lavender"],
  ["border-purple-300/60", "border-primary/60"],
  ["focus:ring-purple-400", "focus-visible:ring-ring"],
  // Shell / overlays
  ["bg-slate-950/90", "bg-background/90"],
  ["bg-slate-950/85", "bg-background/85"],
  ["bg-slate-900", "bg-popover"],
  // Status semantics
  [
    "border-emerald-400/40 bg-emerald-500/20 text-emerald-100",
    "border-success/40 bg-success/20 text-success",
  ],
  [
    "border-amber-400/40 bg-amber-500/20 text-amber-100",
    "border-warning/40 bg-warning/20 text-warning",
  ],
  [
    "border-blue-400/40 bg-blue-500/20 text-blue-100",
    "border-muted-foreground/40 bg-muted text-muted-foreground",
  ],
  ["border-emerald-400/60", "border-success/60"],
  ["bg-emerald-500/20", "bg-success/20"],
  ["text-emerald-100", "text-success"],
  ["text-emerald-300", "text-success"],
  ["border-amber-400/60", "border-warning/60"],
  ["bg-amber-500/20", "bg-warning/20"],
  ["text-amber-100", "text-warning"],
  ["text-amber-300", "text-warning"],
  ["after:bg-blue-400", "after:bg-muted-foreground"],
  ["bg-blue-500/20", "bg-muted"],
  ["border-blue-400/40", "border-muted-foreground/40"],
  // Gradient headings → solid foreground (DESIGN.md typography)
  [
    "bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent",
    "text-foreground",
  ],
  [
    "bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-5xl leading-tight font-bold text-transparent sm:text-6xl lg:text-7xl",
    "display-hero text-5xl leading-tight sm:text-6xl lg:text-7xl",
  ],
  // Decorative orbs
  ["bg-purple-500/20", "bg-primary/20"],
  ["bg-blue-500/15", "bg-primary/10"],
  ["bg-indigo-400/10", "bg-primary/10"],
  // Misc
  ["placeholder-white/40", "placeholder:text-muted-foreground"],
  ["border-red-400/60 focus:ring-red-400", "border-destructive/60 focus-visible:ring-destructive/40"],
  ["border-red-400/60", "border-destructive/60"],
  ["focus:ring-red-400", "focus-visible:ring-destructive/40"],
  ["text-slate-300", "text-muted-foreground"],
  [
    "bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent",
    "headline-lg text-foreground",
  ],
  [
    "bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent",
    "headline-lg text-2xl text-foreground",
  ],
  [
    "bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-2xl font-bold text-transparent",
    "headline-lg text-center text-2xl text-foreground",
  ],
  [
    "bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-sm font-bold tracking-wide text-transparent sm:text-base",
    "text-sm font-bold tracking-wide text-primary sm:text-base",
  ],
  ["border-white/5", "border-border/50"],
  ["bg-white/[0.03]", "bg-muted/30"],
  ["bg-slate-950/70", "bg-background/70"],
  ["border-emerald-500/40", "border-success/40"],
  ["border-amber-500/40", "border-warning/40"],
  ["border-emerald-400/40 bg-emerald-500/15 text-emerald-200", "border-success/40 bg-success/15 text-success"],
  ["border-amber-400/40 bg-amber-500/15 text-warning", "border-warning/40 bg-warning/15 text-warning"],
  ["border-emerald-400/50 bg-success/20 text-emerald-200", "border-success/50 bg-success/20 text-success"],
  ["after:bg-amber-400", "after:bg-warning"],
  ["after:bg-emerald-400", "after:bg-success"],
  ["bg-slate-950 text-white", "bg-background text-foreground"],
  ["isActive && \"bg-blue-500/10 ring-1 ring-blue-400/30 ring-inset\"", "isActive && \"bg-primary/10 ring-1 ring-primary/30 ring-inset\""],
  ["isActive && \"bg-blue-500/10 ring-1 ring-blue-400/40 ring-inset\"", "isActive && \"bg-primary/10 ring-1 ring-primary/40 ring-inset\""],
  ["isDone && \"border-emerald-400 bg-emerald-400\"", "isDone && \"border-success bg-success\""],
  ["isActive && !isDone && \"border-blue-400 bg-blue-400\"", "isActive && !isDone && \"border-primary bg-primary\""],
  ["!isDone && !isActive && \"border-white/25 bg-transparent\"", "!isDone && !isActive && \"border-border bg-transparent\""],
  ["border-slate-500/40 bg-slate-500/10 text-slate-200", "border-muted-foreground/40 bg-muted text-muted-foreground"],
  ["border-blue-400/30 bg-blue-500/10 text-foreground", "border-primary/30 bg-primary/10 text-foreground"],
  ["border-slate-500/30 bg-slate-500/10 text-muted-foreground hover:bg-slate-500/20", "border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-accent"],
  ["border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-success/20", "border-success/30 bg-success/10 text-success hover:bg-success/20"],
  ["border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-warning/20", "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"],
  ["border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200", "border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"],
  ["border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-text-soft", "border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-text-soft"],
  ["rounded-tr-sm bg-blue-600/30 text-white", "rounded-tr-sm bg-primary/30 text-foreground"],
  ["hover:border-blue-300/60 hover:bg-blue-500/25", "hover:border-primary/60 hover:bg-primary/25"],
  ["bg-blue-900/50", "bg-primary/20"],
  ["hover:text-amber-200", "hover:text-warning"],
  ["border-amber-300/60", "border-warning/60"],
  ["border-white/30 border-t-white", "border-foreground/30 border-t-foreground"],
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "ui") walk(p, files);
      else walk(p, files);
    } else if ([".tsx", ".astro", ".ts"].includes(extname(name))) {
      files.push(p);
    }
  }
  return files;
}

let total = 0;
for (const file of walk(ROOT)) {
  if (file.endsWith("global.css") || file.endsWith("ui-classes.ts")) continue;
  let content = readFileSync(file, "utf8");
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    writeFileSync(file, content);
    total++;
    console.log("updated:", file.replace(ROOT + "/", ""));
  }
}
console.log(`\nDone. ${total} files updated.`);
