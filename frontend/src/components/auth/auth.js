import { API_BASE } from "../../config/endpoints.js";

export class AuthClient {
  static async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/status`);
      if (!res.ok) return { isSetup: false, isUnlocked: false };
      return res.json();
    } catch {
      return { isSetup: false, isUnlocked: false };
    }
  }

  static async setup(password) {
    const res = await fetch(`${API_BASE}/api/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.json();
  }

  static async unlock(password) {
    const res = await fetch(`${API_BASE}/api/auth/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.json();
  }

  static async lock() {
    const res = await fetch(`${API_BASE}/api/auth/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  }

  static async reset() {
    const res = await fetch(`${API_BASE}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  }
}

export class AuthModal {
  constructor(overlayEl, { onUnlock } = {}) {
    this.overlayEl = overlayEl;
    this.onUnlock = onUnlock;
    this.currentMode = "unlock"; // "setup" | "unlock" | "reset"
  }

  async checkAndPrompt() {
    const status = await AuthClient.getStatus();

    if (!status.isSetup) {
      this.currentMode = "setup";
      this.render();
      this.show();
      return false;
    }

    if (!status.isUnlocked) {
      this.currentMode = "unlock";
      this.render();
      this.show();
      return false;
    }

    this.hide();
    return true;
  }

  show() {
    if (this.overlayEl) {
      this.overlayEl.hidden = false;
      const input = this.overlayEl.querySelector(".auth-input");
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    }
  }

  hide() {
    if (this.overlayEl) {
      this.overlayEl.hidden = true;
    }
  }

  async lock() {
    await AuthClient.lock();
    this.currentMode = "unlock";
    this.render();
    this.show();
  }

  render() {
    if (!this.overlayEl) return;

    if (this.currentMode === "setup") {
      this.renderSetupView();
    } else if (this.currentMode === "reset") {
      this.renderResetView();
    } else {
      this.renderUnlockView();
    }
  }

  renderSetupView() {
    this.overlayEl.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-icon">🛡️</div>
          <div class="auth-header-text">
            <h2>FINTRACE SECURITY SETUP</h2>
            <p>Create a master password for local desktop access</p>
          </div>
        </div>
        <form class="auth-body" id="auth-form">
          <div id="auth-error-wrap"></div>
          <div class="auth-input-group">
            <label class="auth-label" for="auth-pwd">Set Master Password</label>
            <input class="auth-input" id="auth-pwd" type="password" placeholder="Min. 4 characters" required minlength="4" autofocus />
          </div>
          <div class="auth-input-group">
            <label class="auth-label" for="auth-pwd-confirm">Confirm Password</label>
            <input class="auth-input" id="auth-pwd-confirm" type="password" placeholder="Re-enter password" required minlength="4" />
          </div>
          <button class="auth-submit-btn" type="submit">Initialize & Unlock Terminal →</button>
          <div class="auth-footer-links">
            <span class="auth-link" style="cursor:default; color:#64748b;">Credentials stored locally in AppData</span>
          </div>
        </form>
      </div>
    `;

    const form = this.overlayEl.querySelector("#auth-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = this.overlayEl.querySelector("#auth-pwd").value;
      const confirm = this.overlayEl.querySelector("#auth-pwd-confirm").value;

      if (pwd !== confirm) {
        this.showError("Passwords do not match. Please re-enter.");
        return;
      }

      const res = await AuthClient.setup(pwd);
      if (res.success) {
        this.hide();
        this.onUnlock?.();
      } else {
        this.showError(res.error || "Failed to initialize password");
      }
    });
  }

  renderUnlockView() {
    this.overlayEl.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-icon">🔒</div>
          <div class="auth-header-text">
            <h2>FINTRACE TERMINAL LOCKED</h2>
            <p>Enter local master password to continue</p>
          </div>
        </div>
        <form class="auth-body" id="auth-form">
          <div id="auth-error-wrap"></div>
          <div class="auth-input-group">
            <label class="auth-label" for="auth-pwd">Master Password</label>
            <input class="auth-input" id="auth-pwd" type="password" placeholder="Enter password" required autofocus />
          </div>
          <button class="auth-submit-btn" type="submit">Unlock Terminal →</button>
          <div class="auth-footer-links">
            <span class="auth-link danger" id="auth-reset-trigger">Reset / Clear Credentials</span>
          </div>
        </form>
      </div>
    `;

    const form = this.overlayEl.querySelector("#auth-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = this.overlayEl.querySelector("#auth-pwd").value;
      const res = await AuthClient.unlock(pwd);
      if (res.success) {
        this.hide();
        this.onUnlock?.();
      } else {
        this.showError(res.error || "Incorrect password");
      }
    });

    const resetTrigger = this.overlayEl.querySelector("#auth-reset-trigger");
    resetTrigger?.addEventListener("click", () => {
      this.currentMode = "reset";
      this.render();
    });
  }

  renderResetView() {
    this.overlayEl.innerHTML = `
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-icon">⚠️</div>
          <div class="auth-header-text">
            <h2>RESET LOCAL CREDENTIALS</h2>
            <p>Clear stored password hash and re-initialize setup</p>
          </div>
        </div>
        <div class="auth-body">
          <div id="auth-error-wrap"></div>
          <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
            Resetting authentication will delete your local <code style="color:#f0a830">auth.json</code> configuration. You will be prompted to create a new master password.
          </p>
          <div style="display: flex; gap: 12px; margin-top: 6px;">
            <button class="auth-submit-btn" id="auth-confirm-reset" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-color: rgba(239, 68, 68, 0.4);">
              Confirm Reset
            </button>
            <button class="auth-submit-btn" id="auth-cancel-reset" style="background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); color: #cbd5e1;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;

    this.overlayEl.querySelector("#auth-confirm-reset").addEventListener("click", async () => {
      const res = await AuthClient.reset();
      if (res.success) {
        this.currentMode = "setup";
        this.render();
      } else {
        this.showError(res.error || "Failed to reset authentication");
      }
    });

    this.overlayEl.querySelector("#auth-cancel-reset").addEventListener("click", () => {
      this.currentMode = "unlock";
      this.render();
    });
  }

  showError(message) {
    const wrap = this.overlayEl.querySelector("#auth-error-wrap");
    if (wrap) {
      wrap.innerHTML = `<div class="auth-error-banner"><span>⚠️</span> <span>${message}</span></div>`;
    }
  }
}
