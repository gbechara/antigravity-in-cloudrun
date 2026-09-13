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

"""Lifecycle hooks enforcing swarm guardrails in a headless sandbox.

Three classes of guardrail live here:

1. Command policy      -- block destructive commands (`terraform apply`).
2. Sub-tree scoping    -- keep every agent's writes inside $TARGET_APP_DIR.
3. Headless safety     -- ensure the swarm can never block on a human.

(3) matters because this runs as a batch job in a Cloud Run sandbox. There is
no interactive user, so an `ask_question` tool call is unanswerable: at best it
wastes a turn, at worst the run blocks until the task timeout.
"""

import logging
import os
from typing import Any, Dict, List

from google.antigravity import types
from google.antigravity.hooks import hooks

logger = logging.getLogger("antigravity.swarm.audit")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")

# Tools whose arguments name a file the agent intends to write.
_WRITE_TOOLS = {
    types.BuiltinTools.CREATE_FILE.value,
    types.BuiltinTools.EDIT_FILE.value,
}

# Argument keys used by the file tools to carry the target path. The SDK also
# populates ToolCall.canonical_path for file tools, which is preferred when set.
_PATH_KEYS = ("TargetFile", "AbsolutePath", "target_file", "absolute_path", "path")


def _target_app_dir() -> str:
    return os.path.abspath(os.environ.get("TARGET_APP_DIR", "/workspace/target-app"))


def _allowed_write_roots() -> List[str]:
    """Directories any agent may write to, regardless of its role."""
    roots = [_target_app_dir(), "/tmp"]
    artifacts = os.environ.get("ARTIFACTS_DIR")
    if artifacts:
        roots.append(os.path.abspath(artifacts))
    return roots


def _extract_command(data: types.ToolCall) -> str:
    """Pulls the shell command out of a run_command tool call.

    ToolCall carries arguments in `.args`; the harness uses `CommandLine`.
    """
    args: Dict[str, Any] = getattr(data, "args", None) or {}
    if not isinstance(args, dict):
        return ""
    return str(args.get("CommandLine") or args.get("command") or "")


def _extract_write_path(data: types.ToolCall) -> str:
    """Pulls the destination path out of a file-writing tool call."""
    canonical = getattr(data, "canonical_path", None)
    if canonical:
        return str(canonical)
    args: Dict[str, Any] = getattr(data, "args", None) or {}
    if not isinstance(args, dict):
        return ""
    for key in _PATH_KEYS:
        value = args.get(key)
        if value:
            return str(value)
    return ""


def _is_within(path: str, root: str) -> bool:
    """True if `path` resolves inside `root` (defeats ../ traversal)."""
    try:
        return os.path.commonpath([os.path.abspath(path), root]) == root
    except ValueError:
        # Raised when the paths live on different drives / are not comparable.
        return False


@hooks.post_tool_call
async def audit_tool_execution(data):
    """Emits structured audit entries for Cloud Logging on every tool action."""
    tool_name = getattr(data, "name", "unknown_tool")
    logger.info(f"[TOOL AUDIT] Executed: {tool_name}")


@hooks.pre_tool_call_decide
async def validate_tool_boundaries(data) -> types.HookResult:
    """Blocks destructive commands, out-of-scope writes, and human prompts."""
    tool_name = str(getattr(data, "name", ""))

    # --- Guardrail 1: never mutate real infrastructure unattended. ---
    if tool_name == types.BuiltinTools.RUN_COMMAND.value:
        cmd = _extract_command(data)
        if "terraform apply" in cmd:
            logger.warning(f"[POLICY VIOLATION BLOCKED] Attempted 'terraform apply': {cmd}")
            # NOTE: HookResult exposes `message` (not `reason`). Using `reason`
            # here would be silently dropped by pydantic and the agent would
            # receive an empty explanation, leaving it unable to self-correct.
            return types.HookResult(
                allow=False,
                message=(
                    "Automated 'terraform apply' is restricted without a manual gate. "
                    "Use 'terraform validate' or 'terraform plan' instead."
                ),
            )

    # --- Guardrail 2: there is no human attached to a batch run. ---
    if tool_name == types.BuiltinTools.ASK_QUESTION.value:
        logger.warning("[HEADLESS] Blocked ask_question; no interactive user is attached.")
        return types.HookResult(
            allow=False,
            message=(
                "This swarm runs headless in a Cloud Run sandbox, so ask_question can "
                "never be answered. Choose the most reasonable option yourself, record "
                "the assumption in a comment or in your final report, and continue."
            ),
        )

    # --- Guardrail 3: keep each agent inside the target application tree. ---
    if tool_name in _WRITE_TOOLS and os.environ.get("SWARM_ENFORCE_SCOPE", "1") == "1":
        path = _extract_write_path(data)
        roots = _allowed_write_roots()
        if path and not any(_is_within(path, root) for root in roots):
            target = _target_app_dir()
            logger.warning(f"[SCOPE VIOLATION BLOCKED] Write outside target tree: {path}")
            return types.HookResult(
                allow=False,
                message=(
                    f"Write to '{path}' is outside the swarm's target tree. All generated "
                    f"application code must live under '{target}' (for example "
                    f"'{target}/client/...' or '{target}/server/...'). "
                    "Re-issue the write with a path inside that tree."
                ),
            )

    return types.HookResult(allow=True)


@hooks.on_interaction
async def auto_answer_interactions(data) -> types.QuestionHookResult:
    """Backstop so a well-formed question can never hang the batch job.

    Guardrail 2 denies `ask_question` at the tool-call boundary, but the harness
    can raise interactions through other paths. Anything that reaches here is
    answered as 'skipped', which tells the agent to proceed on its own judgment
    rather than waiting on a user who does not exist.
    """
    questions = getattr(data, "questions", None) or []
    logger.warning(f"[HEADLESS] Auto-skipping {len(questions)} agent question(s).")
    return types.QuestionHookResult(
        responses=[
            types.QuestionResponse(
                selected_option_ids=[],
                freeform_response=(
                    "No interactive user is available (headless sandbox run). "
                    "Proceed with the most reasonable default and document the assumption."
                ),
                skipped=True,
            )
            for _ in questions
        ],
        cancelled=False,
    )
