# 🔑 Google Sign-In Setup Guide
## Get a free Google Client ID in 4 steps (~2 minutes)

---

## Step 1 — Create a Google Cloud Project

1. Open → **https://console.cloud.google.com**
2. Sign in with any Google account (personal Gmail is fine)
3. Click **"Select a project"** at the top → **"New Project"**
4. Name it `ARIA` → click **Create**
5. Wait a few seconds for it to create, then select it

---

## Step 2 — Configure the OAuth Consent Screen

1. Left sidebar → **APIs & Services** → **OAuth consent screen**
2. Select **External** → click **Create**
3. Fill in the form:
   - **App name**: `ARIA`
   - **User support email**: your Gmail address
   - **Developer contact email**: your Gmail address
4. Click **Save and Continue**
5. On "Scopes" page → click **Save and Continue** (no changes needed)
6. On "Test users" page → click **Save and Continue**
7. Click **Back to Dashboard**

---

## Step 3 — Create an OAuth Client ID

1. Left sidebar → **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. **Application type**: `Web application`
4. **Name**: `ARIA Web Client`
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:

   **For local file (double-click to open):**
   ```
   http://localhost
   ```

   **If running with a local server (npx serve):**
   ```
   http://localhost:3000
   http://localhost:3001
   ```

   **If deployed online (replace with your URL):**
   ```
   https://your-app.netlify.app
   https://your-app.vercel.app
   ```

6. Click **Create**

---

## Step 4 — Copy Your Client ID

A popup appears with your credentials:

```
Client ID:     123456789012-abcdefghijklmnopqrst.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```

**Copy the Client ID** (you don't need the secret for this app).

---

## Step 5 — Use It in ARIA

1. Open `frontend/index.html` in **Chrome** or **Edge**
2. Click **"Set Up Google Sign-In"**
3. Paste your Client ID
4. Click **Continue with Google**
5. Sign in with your Google account
6. ✅ Done! Your name and photo appear in the app

---

## Troubleshooting

### "This app isn't verified"
- Click **Advanced** → **Go to ARIA (unsafe)**
- This warning appears for apps in development — it's safe for personal use
- To remove it: complete Google's verification process (not needed for personal use)

### Google button doesn't appear
- Make sure you're using **Chrome or Edge** (Firefox has stricter restrictions for local files)
- Try running with a local server: `npx serve frontend` then open `http://localhost:3000`

### "Error 400: redirect_uri_mismatch"
- Add your exact current URL to the Authorized JavaScript Origins list in Step 3
- Wait 5 minutes for Google's changes to propagate

### Opening from file:// (double-clicking the HTML)
- Add `http://localhost` to authorized origins
- Or run a local server:
  ```bash
  # Option A
  npx serve frontend
  
  # Option B (Python)
  cd frontend && python3 -m http.server 8080
  
  # Then open http://localhost:8080
  ```

### Client ID not saving
- The Client ID is stored in your browser's localStorage
- It persists across sessions — you only need to enter it once per browser

---

## Skip Google Entirely

On the sign-in screen, you can:
- Enter your **name** and click **Launch ARIA** — instant access, no Google needed
- Click **"Continue in Demo Mode"** — anonymous access

All features work the same way regardless of sign-in method.
