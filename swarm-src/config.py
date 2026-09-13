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

import os

class AppConfig:
    PROJECT_ID = os.environ.get("GCP_PROJECT", os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    REGION = os.environ.get("GCP_REGION", "us-east4")
    TARGET_APP_DIR = os.environ.get("TARGET_APP_DIR", "/workspace/target-app")
    CONTROL_PLANE_DIR = os.environ.get("CONTROL_PLANE_DIR", "/app/control-plane")
    STORAGE_DIR = os.environ.get("STORAGE_DIR", "/app/storage")
    
    # Model configuration. Only Gemini 2.5 Flash / Pro are currently served by
    # Vertex AI in this project; the 3.x aliases the harness knows about are
    # Antigravity-backend names and return 404 when vertex=True.
    DEFAULT_MODEL = os.environ.get("ANTIGRAVITY_MODEL", "gemini-2.5-flash").strip().rstrip("~./ ")
    
    @classmethod
    def get_paths(cls):
        return {
            "sessions": os.path.join(cls.STORAGE_DIR, "sessions"),
            "artifacts": os.path.join(cls.STORAGE_DIR, "artifacts"),
            "skills": os.path.join(cls.CONTROL_PLANE_DIR, "skills"),
            "agents": os.path.join(cls.CONTROL_PLANE_DIR, "agents"),
            "orchestrator": os.path.join(cls.CONTROL_PLANE_DIR, "orchestrator.md"),
        }
