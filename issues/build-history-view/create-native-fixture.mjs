#!/usr/bin/env node
// Opt-in native Pi 0.85.1 fixture. Requires an explicit disposable root; never
// uses the default session directory or opens an existing home.
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
const pkg = process.env.PI_PACKAGE_ROOT;
if (!root || !pkg || !resolve(root).startsWith("/tmp/") || resolve(root) === "/tmp" || root !== resolve(root)) throw new Error("provide an absolute /tmp disposable root and PI_PACKAGE_ROOT");
const { SessionManager } = await import(pathToFileURL(join(pkg, "dist/index.js")).href);
const cwd = join(root,"home","src","demo");
const sessions = join(root,"home",".pi","agent","sessions");
await mkdir(cwd,{recursive:true});
await mkdir(sessions,{recursive:true});
const manager=SessionManager.create(cwd,sessions,{id:"11111111-1111-4111-8111-111111111111"});
manager.appendMessage({role:"user",content:"synthetic native user",timestamp:0});
manager.appendMessage({role:"assistant",content:[{type:"text",text:"synthetic native assistant"}],api:"probe",provider:"probe",model:"probe",usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:"stop",timestamp:0});
console.log(manager.getSessionFile());
