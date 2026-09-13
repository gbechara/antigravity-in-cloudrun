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

import argparse
import asyncio
import os
import resource
import sys
import logging
from typing import Optional

from config import AppConfig
from hooks import audit_tool_execution, auto_answer_interactions, validate_tool_boundaries

logger = logging.getLogger("antigravity.swarm")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")


def _raise_fd_limit():
    """Raises the open-file limit for the harness and every child process.

    /workspace is a gcsfuse mount. gcsfuse holds a file descriptor per open
    object, so npm installs and bulk `mv` operations across a node_modules tree
    exhaust the default soft limit and fail with "Too many open files".
    """
    try:
        soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
        if soft < hard:
            resource.setrlimit(resource.RLIMIT_NOFILE, (hard, hard))
            logger.info(f"Raised open-file limit from {soft} to {hard}.")
    except (ValueError, OSError) as exc:
        logger.warning(f"Could not raise open-file limit: {exc}")


# Optional FastAPI server integration
try:
    from fastapi import FastAPI, BackgroundTasks
    import uvicorn
    from pydantic import BaseModel

    app = FastAPI(title="Antigravity Swarm Remote Runner", version="1.0.0")

    class SwarmRunRequest(BaseModel):
        task_prompt: str = ""
        target_dir: str = AppConfig.TARGET_APP_DIR

    @app.get("/healthz")
    async def health_check():
        return {"status": "healthy", "service": "antigravity-swarm-runner"}

    @app.post("/api/swarm/run")
    async def run_swarm_endpoint(req: SwarmRunRequest, background_tasks: BackgroundTasks):
        background_tasks.add_task(execute_swarm, req.task_prompt, req.target_dir)
        return {"status": "started", "message": "Swarm dispatched asynchronously."}
except ImportError:
    app = None

from google.antigravity import Agent, LocalAgentConfig, types
from google.antigravity.hooks import policy

async def execute_swarm(task_prompt: str = "", target_dir: Optional[str] = None):
    paths = AppConfig.get_paths()
    effective_target_dir = target_dir or AppConfig.TARGET_APP_DIR

    _raise_fd_limit()

    # Ensure persistence and workspace folders exist
    os.makedirs(paths["sessions"], exist_ok=True)
    os.makedirs(paths["artifacts"], exist_ok=True)
    os.makedirs(effective_target_dir, exist_ok=True)

    config = LocalAgentConfig(
        vertex=True,
        project=AppConfig.PROJECT_ID if AppConfig.PROJECT_ID else None,
        location=AppConfig.REGION,
        model=AppConfig.DEFAULT_MODEL,
        save_dir=paths["sessions"],
        app_data_dir=paths["artifacts"],
        skills_paths=[paths["skills"], paths["agents"]],
        capabilities=types.CapabilitiesConfig(
            enable_subagents=True,
        ),
        policies=[policy.allow_all()],
        hooks=[audit_tool_execution, validate_tool_boundaries, auto_answer_interactions],
        env={
            "TARGET_APP_DIR": effective_target_dir,
            "ARTIFACTS_DIR": paths["artifacts"],
            "PATH": os.environ.get("PATH", ""),
            # No DISPLAY is set on purpose. There is no Xvfb and no browser in
            # this image: testing is curl-based to keep the container small.
            # Advertising a virtual display would only invite a tool to try
            # launching a GUI that cannot exist here.
            # The harness classifies command output to detect prompts waiting on
            # stdin. That classifier issues its own model call with thinking
            # disabled but include_thoughts set, which Gemini 2.5 rejects, so
            # detection is unavailable here. Force every tool to be
            # non-interactive rather than relying on it.
            "CI": "true",
            "DEBIAN_FRONTEND": "noninteractive",
            "NPM_CONFIG_YES": "true",
            "PIP_NO_INPUT": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "TF_IN_AUTOMATION": "1",
            "TF_INPUT": "0",
            # Keep high-churn caches off the gcsfuse mount; writing thousands of
            # small files through GCS is slow and exhausts file descriptors.
            "NPM_CONFIG_CACHE": "/tmp/npm-cache",
            "TMPDIR": "/tmp",
        },
    )

    with open(paths["orchestrator"], "r") as f:
        orchestrator_playbook = f.read()

    full_prompt = orchestrator_playbook
    if task_prompt:
        full_prompt += f"\n\n### User Feature Request:\n{task_prompt}"

    logger.info(f"Starting Antigravity Swarm on target: {effective_target_dir}")
    async with Agent(config=config) as agent:
        response = await agent.chat(full_prompt)
        result_text = await response.text()
        logger.info("Swarm Execution Complete.")

        usage = agent.conversation.total_usage
        logger.info(f"Session Token Usage: Prompt={usage.prompt_token_count}, "
                    f"Candidates={usage.candidates_token_count}, "
                    f"Thinking={usage.thoughts_token_count}")
        return result_text

def main():
    parser = argparse.ArgumentParser(description="Antigravity Swarm Runner")
    parser.add_argument("--mode", choices=["server", "cli"], default="cli", help="Execution mode")
    parser.add_argument("--prompt", type=str, default="", help="Feature prompt for CLI mode")
    parser.add_argument("--target-dir", type=str, default=AppConfig.TARGET_APP_DIR, help="Target application directory")
    args = parser.parse_args()

    if args.mode == "cli":
        logger.info("Running in Cloud Run Sandbox / CLI Batch Mode")
        asyncio.run(execute_swarm(task_prompt=args.prompt, target_dir=args.target_dir))
    else:
        if app is None:
            logger.error("FastAPI and uvicorn are required for server mode.")
            sys.exit(1)
        logger.info("Running in Cloud Run Service / FastAPI Server Mode on port 8080")
        port = int(os.environ.get("PORT", 8080))
        uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    main()
