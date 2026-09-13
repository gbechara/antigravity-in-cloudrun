#!/usr/bin/env python3
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Appends the shared headless-execution rules to every agent contract.

Idempotent: re-running leaves already-patched contracts untouched.
"""

import pathlib
import sys

MARKER = "## Execution Environment (Headless Sandbox)"

BLOCK = """
---

## Execution Environment (Headless Sandbox)

You are running as a batch job inside a Cloud Run sandbox. There is **no human
attached to this session**.

* **Never call `ask_question`.** It cannot be answered and the call is blocked
  by a policy hook. If a requirement is ambiguous, pick the most reasonable
  option, state the assumption in a code comment or your final report, and keep
  going.
* **Resolve `$TARGET_APP_DIR` before writing.** It defaults to
  `/workspace/target-app`. Every file you create must sit under that directory,
  never directly under `/workspace`. Writing to `/workspace/client` instead of
  `$TARGET_APP_DIR/client` is a scope violation and will be rejected.
* **Keep commands non-interactive.** Nothing can answer a prompt on stdin, so
  always pass the non-interactive flag (`npm ci`, `npx --yes`, `apt-get -y`,
  `terraform -input=false`). A command that waits for input will stall until the
  task times out.
* **`/workspace` is a GCS-backed fuse mount.** It is slow for many small files
  and has a finite file-descriptor budget. Do not bulk-move or recursively copy
  `node_modules`; install dependencies in place instead, and prefer
  `npm ci --no-audit --no-fund`.
"""


def main() -> int:
    agents_dir = pathlib.Path(__file__).resolve().parents[1] / "control-plane" / "agents"
    if not agents_dir.is_dir():
        print(f"ERROR: not found: {agents_dir}", file=sys.stderr)
        return 1

    changed = 0
    for path in sorted(agents_dir.glob("*.md")):
        text = path.read_text()
        if MARKER in text:
            print(f"skip (already patched): {path.name}")
            continue
        path.write_text(text.rstrip("\n") + "\n" + BLOCK)
        print(f"patched: {path.name}")
        changed += 1

    print(f"\n{changed} contract(s) patched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
