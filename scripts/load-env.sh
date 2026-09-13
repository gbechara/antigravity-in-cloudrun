#!/usr/bin/env bash
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

# Shared .env loader, sourced by deploy-instance.sh, deploy.sh and run-local.sh.
#
# Deliberately NOT implemented as `set -a; . .env; set +a`. That form clobbers
# variables already present in the environment, which would silently defeat the
# common one-off override:
#
#     BUCKET_NAME=other-bucket ./deploy-instance.sh
#
# Precedence, strongest first:  CLI argument  >  exported shell variable
#                               >  .env file  >  built-in default.

load_env_file() {
  local env_file="$1"
  [ -f "$env_file" ] || return 0

  echo "--> Loading configuration from $(basename "$env_file")"

  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blanks and comments.
    case "$line" in '' | '#'*) continue ;; esac
    # Skip anything that is not a KEY=VALUE pair.
    case "$line" in *=*) ;; *) continue ;; esac

    key="${line%%=*}"
    value="${line#*=}"

    # Trim surrounding whitespace from the key (supports "KEY = value").
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [ -z "$key" ] && continue

    # Ignore keys that are not valid shell identifiers.
    case "$key" in
      [!A-Za-z_]* | *[!A-Za-z0-9_]*) continue ;;
    esac

    # Trim surrounding whitespace from the value. A stray trailing space in
    # something like a region name would silently break downstream flags.
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    # Strip one layer of surrounding quotes from the value, if present.
    case "$value" in
      \"*\") value="${value#\"}" ; value="${value%\"}" ;;
      \'*\') value="${value#\'}" ; value="${value%\'}" ;;
    esac

    # Never clobber an explicit override from the caller's environment.
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$env_file"
}
