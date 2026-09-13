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

# ---------------------------------------------------------------------------
# Stage 1: builder
#
# Compiles the Next.js app, then strips everything that is only needed to
# *produce* the build. This has to be a separate stage: image layers are
# additive, so deleting these files in a later RUN of a single-stage build
# would leave them in the layer history and save nothing.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# node-pty is a native addon and needs a toolchain to compile.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY frontend/package*.json ./
RUN npm install --include=dev

COPY frontend/ .
# `next build` imports the application to collect page data, and Next.js forces
# NODE_ENV=production for that pass. That makes the strict startup checks in
# src/lib/auth.ts fire during the build: the app refuses to start in production
# without a signing secret, which is correct at runtime but fails the build on
# any machine that legitimately has no secrets.
#
# These are throwaway values scoped to this single RUN instruction. They are
# shell variables, not ENV layers, so nothing is written into the image and no
# placeholder can ever be used to serve a request. A deployment that forgets to
# supply the real values still fails at startup, as intended.
RUN NEXTAUTH_SECRET="build-only-placeholder-never-used-to-sign-anything" \
    ADMIN_PASSWORD="build-only-placeholder" \
    npm run build

# Strip build-only artifacts. Measured: /app drops from 439 MB to 184 MB.
#   * devDependencies — typescript and @types are needed to compile, not serve.
#     Note tsc was never on PATH; the quality gate runs `npm run type-check`
#     inside $TARGET_APP_DIR, against that app's own toolchain.
#   * @next/swc — the 126 MB Rust compiler. Only `next build` uses it; serving
#     a prebuilt .next does not.
#   * .next/cache — 46 MB webpack cache, and the last place in the image that
#     still contained compiled-in "playwright" strings.
#   * next/experimental/testmode/playwright — Next's own Playwright test-mode
#     adapter. Unused here, and this image ships no browser by design.
#   * node-pty/prebuilds — 58 MB of binaries for other platforms. lib/utils.js
#     resolves build/Release first and only falls back to prebuilds, and the
#     addon was compiled from source above.
RUN npm prune --omit=dev \
    && rm -rf \
        .next/cache \
        .next/trace \
        node_modules/next/dist/experimental \
        node_modules/next/experimental \
        node_modules/node-pty/prebuilds \
        node_modules/.bin/tsc \
        node_modules/.bin/tsserver \
    && rm -rf node_modules/@next/swc-* \
    && find node_modules -type d -empty -delete

# ---------------------------------------------------------------------------
# Stage 2: runtime tool harness
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim


ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace
ENV TARGET_APP_DIR=/workspace/target-app
ENV CONTROL_PLANE_DIR=/app/control-plane
ENV STORAGE_DIR=/app/storage
# NEXTAUTH_SECRET is deliberately NOT set here. Baking a signing key into a
# public image means every deployment shares it, which lets anyone forge a
# valid admin session. It must be supplied at deploy time.
ENV PATH="/usr/local/google-cloud-sdk/bin:${PATH}"

# 1. Install base utilities and Python runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    tar \
    python3 \
    python3-pip \
    python3-venv \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 2. Dedicated non-root user. Created before the SDK install so that ownership
#    can be set in the same layer as the download; a later `chown -R` on the
#    SDK would copy-on-write the entire directory into a duplicate layer.
RUN useradd -m -u 1001 -s /bin/bash agy

# 3. Copy static standalone Terraform binary from official HashiCorp image
COPY --from=hashicorp/terraform:1.9 /bin/terraform /usr/local/bin/terraform

# 4. Install lightweight Google Cloud SDK (gcloud & gsutil)
RUN curl -sSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz \
    | tar -xz -C /usr/local/ \
    && ln -s /usr/local/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud \
    && ln -s /usr/local/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil \
    && chown -R agy:agy /usr/local/google-cloud-sdk

# 5. Install Google Antigravity SDK & GCP libraries for Sandbox Swarm Execution
RUN pip3 install --no-cache-dir --break-system-packages \
    google-antigravity>=0.1.0 \
    google-cloud-storage>=2.17.0 \
    google-cloud-secret-manager>=2.20.0 \
    fastapi>=0.111.0 \
    uvicorn[standard]>=0.30.0 \
    pydantic>=2.7.0

WORKDIR /app

# Build context is the REPOSITORY ROOT (see cloudbuild.frontend.yaml), so that
# swarm-src/ and control-plane/ are shared with the backend image rather than
# duplicated. All frontend paths are therefore prefixed with 'frontend/'.

# 6. Application: the already-built, already-pruned tree from the builder
#    stage. Nothing is compiled here, so none of the build-only tooling
#    (SWC, typescript, the webpack cache) ends up in the shipped image.
COPY --from=builder --chown=agy:agy /app /app

# 7. Shared swarm runner & control plane (single source of truth at repo root)
COPY --chown=agy:agy swarm-src /app/swarm-src
COPY --chown=agy:agy control-plane /app/control-plane

# 8. Copy and setup CLI wrapper 'swarm'
COPY frontend/bin/swarm /usr/local/bin/swarm
RUN chmod +x /usr/local/bin/swarm

# 9. Writable directories for the agy user.
#    Ownership of /app is already set by the COPY --chown directives above. A
#    recursive `chown -R /app` here would copy-on-write all ~184 MB into a new
#    layer and undo the pruning done in the builder stage, so the chown is
#    scoped to the paths actually created below.
RUN mkdir -p /app/storage/sessions /app/storage/artifacts /workspace/target-app/infra/terraform \
    && chown -R agy:agy /app/storage /workspace

# The Cloud Run sandbox launcher creates a network namespace per sandbox and
# expects to be able to mkdir /var/run/netns. /var/run is root-owned, so as a
# non-root user that fails with EACCES and every `sandbox do` invocation dies
# before it starts. Pre-creating the directory with the right owner lets the
# launcher work without granting the container root.
RUN mkdir -p /var/run/netns && chown agy:agy /var/run/netns

ENV NODE_ENV=production
USER agy
EXPOSE 3000

CMD ["node", "server.js"]
