/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import fs from "fs";
import path from "path";

const TARGET_DIR = process.env.TARGET_APP_DIR || "/workspace/target-app";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

const IGNORED_DIRS = new Set(["node_modules", "dist", "build", ".terraform", ".git", ".next", ".cache"]);

function getFileTree(dir: string, baseDir: string = dir): FileNode[] {
  if (!fs.existsSync(dir)) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        results.push({
          name: entry.name,
          type: "folder",
          path: relPath,
          children: getFileTree(fullPath, baseDir),
        });
      } else {
        results.push({
          name: entry.name,
          type: "file",
          path: relPath,
        });
      }
    }
    return results;
  } catch (err) {
    console.error("Error reading file tree:", err);
    return [];
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (file) {
    const safePath = path.normalize(file).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(TARGET_DIR, safePath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, "utf8");
      return NextResponse.json({ path: safePath, content });
    }
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const tree = getFileTree(TARGET_DIR);
  return NextResponse.json({ assets: tree, targetDir: TARGET_DIR });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (fs.existsSync(TARGET_DIR)) {
      const entries = fs.readdirSync(TARGET_DIR);
      for (const entry of entries) {
        const fullPath = path.join(TARGET_DIR, entry);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    return NextResponse.json({
      success: true,
      message: "Generated swarm assets cleanly reset.",
      assets: [],
    });
  } catch (err: any) {
    console.error("Failed to reset assets:", err);
    return NextResponse.json({ error: err?.message || "Failed to reset assets" }, { status: 500 });
  }
}
