# Google Cloud OAuth 2.0 / SSO Setup Guide

This guide details how to configure Google OAuth 2.0 Single Sign-On (SSO) for the **Antigravity Console** in both local development and remote Google Cloud Run sandbox environments.

---

## 1. Overview

The Antigravity Console uses **NextAuth.js** to provide dual authentication methods:
1. **Built-in Admin Credentials:** `ADMIN_USERNAME` (default `admin`) and `ADMIN_PASSWORD`, generated per deployment and printed by the deploy scripts unless you pin them in `.env`. Zero external dependencies.
2. **Google Cloud SSO:** Standard OAuth 2.0 flow via Google Cloud Identity and Google Accounts.

To enable Google Cloud SSO, you must create an **OAuth 2.0 Web Client ID** in your Google Cloud project and supply the credentials to the container.

---

## 2. Setting Up Google Cloud Console

### Step 1: Configure the OAuth Consent Screen
1. Navigate to the Google Cloud Console: **APIs & Services > OAuth consent screen**.
2. Select your **User Type**:
   * **Internal:** Recommended if your deployment is restricted to users within your Google Workspace organization. No app verification is needed.
   * **External:** If allowing accounts outside your Workspace org. Note: While in "Testing" publishing status, you must explicitly add user email addresses under **Test users**.
3. Fill in the mandatory app details:
   * **App name:** `Antigravity Console`
   * **User support email:** Your email address.
   * **Developer contact email:** Your email address.
4. Click **Save and Continue** through Scopes (default `openid`, `email`, `profile` are sufficient).

### Step 2: Create OAuth 2.0 Web Client Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. In the **Application type** dropdown, select **Web application**.
4. Set the **Name** (e.g., `Antigravity Console Web Client`).
5. Under **Authorized JavaScript origins**, add:
   * For local development:
     * `http://localhost:3000`
   * For remote Cloud Run sandbox:
     * `https://<YOUR-CLOUD-RUN-INSTANCE-OR-SERVICE-URL>` (e.g., `https://antigravity-console-instance-xyz.us-east4.run.app`)
6. Under **Authorized redirect URIs**, add:
   * For local development:
     * `http://localhost:3000/api/auth/callback/google`
   * For remote Cloud Run sandbox:
     * `https://<YOUR-CLOUD-RUN-INSTANCE-OR-SERVICE-URL>/api/auth/callback/google`
7. Click **Create**.
8. Copy the generated **Client ID** and **Client Secret**.

> **Important:** Google OAuth 2.0 requires an exact match on redirect URIs. The trailing path must always be `/api/auth/callback/google`.

---

## 3. Supplying Credentials to the Application

### Option A: Local Development (`run-local.sh`)

Export the credentials as environment variables before starting the local container:

```bash
export GOOGLE_CLIENT_ID="1234567890-abcdefg.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxx"

./run-local.sh restart
```

The script will automatically forward `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into the Docker container.

### Option B: Cloud Run Deployment via Terraform

Pass the credentials into Terraform when applying your infrastructure:

```bash
cd terraform
terraform apply \
  -var="project_id=YOUR_PROJECT_ID" \
  -var="region=us-east4" \
  -var="google_client_id=1234567890-abcdefg.apps.googleusercontent.com" \
  -var="google_client_secret=GOCSPX-xxxxxxxxxxxxxxxxxxxx"
```

Or declare them in a `terraform.tfvars` file (ensure this file is gitignored):

```hcl
project_id           = "YOUR_PROJECT_ID"
region               = "us-east4"
google_client_id     = "1234567890-abcdefg.apps.googleusercontent.com"
google_client_secret = "GOCSPX-xxxxxxxxxxxxxxxxxxxx"
```

---

## 4. Troubleshooting Common OAuth Errors

| Error Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **`[SIGNIN_OAUTH_ERROR] client_id is required`** | The environment variable `GOOGLE_CLIENT_ID` is empty or unset inside the container. | Verify `GOOGLE_CLIENT_ID` is set in your container environment or Terraform configuration. |
| **`Error 400: redirect_uri_mismatch`** | The redirect URI sent by the browser does not match the list in GCP Credentials. | Ensure `https://<YOUR-APP-URL>/api/auth/callback/google` is registered under **Authorized redirect URIs** in the GCP Console. |
| **`Error 403: access_denied`** | The OAuth consent screen is External and in "Testing" mode, but the user is not in the Test Users list. | Add the user's email to **Test users** on the OAuth consent screen in GCP Console, or publish the app. |
| **`Error 400: invalid_request`** | Missing or malformed client credentials or scopes. | Verify that the Client Secret has not expired or been deleted. |
