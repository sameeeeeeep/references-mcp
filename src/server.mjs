#!/usr/bin/env node
// references-mcp over stdio.
//   REFERENCES_DIR        your library + taste log + live cache (default ~/.references)
//   REFERENCES_LIBRARIES  extra read-only folders of references, path-delimiter separated
//   REFERENCES_LIVE=0     skip live pulls from the curations (offline / canon + library only)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { registerReferenceTools } from './references.mjs';

const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
const dir = expand(process.env.REFERENCES_DIR || join(homedir(), '.references'));
const libraries = String(process.env.REFERENCES_LIBRARIES || '').split(delimiter).map((s) => s.trim()).filter(Boolean).map(expand);

const server = new McpServer({ name: 'references', version: '0.1.0' });
registerReferenceTools(server, { dir, libraries, live: process.env.REFERENCES_LIVE !== '0' });
await server.connect(new StdioServerTransport());
