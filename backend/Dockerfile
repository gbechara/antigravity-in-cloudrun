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

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV TARGET_APP_DIR=/workspace/target-app
ENV WORKSPACE_DIR=/workspace

# 1. Install minimal system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy standalone Terraform binary directly from official HashiCorp image
COPY --from=hashicorp/terraform:1.9 /bin/terraform /usr/local/bin/terraform

# 3. Create Dedicated Non-Root User
RUN useradd -m -u 1001 -s /bin/bash agy
WORKDIR /app

# Build context is the REPOSITORY ROOT (see cloudbuild.backend.yaml), so that
# swarm-src/ and control-plane/ can be shared with the frontend image instead
# of being duplicated into each build context.
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 5. Setup Directory Layout with Strict Permissions
RUN mkdir -p /app/control-plane /app/storage /workspace/target-app /workspace/target-app/infra/terraform \
    && chown -R agy:agy /app /workspace

COPY --chown=agy:agy ./control-plane /app/control-plane
COPY --chown=agy:agy ./swarm-src /app/src

USER agy
EXPOSE 8080

ENTRYPOINT ["python3", "/app/src/main.py"]
CMD ["--mode=server"]
