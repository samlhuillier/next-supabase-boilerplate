import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface AuthConfig {
  url: string;
  anonKey: string;
}

class AuthManager {
  private supabase: SupabaseClient | null = null;
  private isInitialized = false;

  private getConfig(): AuthConfig {
    const url = "https://nslopnzkxqewltigsuhd.supabase.co";
    const anonKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbG9wbnpreHFld2x0aWdzdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTEwMTMsImV4cCI6MjA2MTc2NzAxM30.RyHPvU2fsfKfeep5jc64UTfi_cGlclmWMY76dbXJOgY";

    return { url, anonKey };
  }

  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const config = this.getConfig();
    this.supabase = createClient(config.url, config.anonKey);
    this.isInitialized = true;
  }

  async signInWithHashedToken(
    hashedToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.initialize();

      if (!this.supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { data, error } = await this.supabase.auth.verifyOtp({
        token_hash: hashedToken,
        type: "email",
      });

      if (error) {
        console.error("Authentication error:", error);
        return { success: false, error: error.message };
      }

      if (data.session) {
        console.log("Authentication successful:", data.user?.email);

        // Store session information
        await this.storeSession(data.session);

        // Notify the renderer process about successful authentication
        this.notifyAuthSuccess(data.user);

        return { success: true };
      }

      return { success: false, error: "No session created" };
    } catch (error) {
      console.error("Failed to authenticate:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async storeSession(session: any): Promise<void> {
    try {
      const fs = require("fs");
      const path = require("path");
      const { app } = require("electron");

      const sessionData = JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: session.user,
      });

      const userDataPath = app.getPath("userData");
      const sessionPath = path.join(userDataPath, "session.json");
      fs.writeFileSync(sessionPath, sessionData, "utf8");

      console.log("Session stored");
    } catch (error) {
      console.error("Failed to store session:", error);
    }
  }

  private async loadStoredSession(): Promise<any> {
    try {
      const fs = require("fs");
      const path = require("path");
      const { app } = require("electron");

      const userDataPath = app.getPath("userData");
      const sessionPath = path.join(userDataPath, "session.json");

      if (!fs.existsSync(sessionPath)) {
        return null;
      }

      const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf8"));

      // Check if session is still valid (not expired)
      if (
        sessionData.expires_at &&
        Date.now() < sessionData.expires_at * 1000
      ) {
        return sessionData;
      }

      return null;
    } catch (error) {
      console.error("Failed to load stored session:", error);
      return null;
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      this.initialize();

      if (!this.supabase) {
        throw new Error("Supabase client not initialized");
      }

      // First try to load stored session
      const storedSession = await this.loadStoredSession();
      if (storedSession) {
        // Set the session in Supabase
        await this.supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        return storedSession.user;
      }

      // If no stored session, try to get current user from Supabase
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error) {
        console.error("Error getting current user:", error);
        return null;
      }

      return user;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      this.initialize();

      if (!this.supabase) {
        throw new Error("Supabase client not initialized");
      }

      await this.supabase.auth.signOut();

      // Remove stored session
      try {
        const fs = require("fs");
        const path = require("path");
        const { app } = require("electron");

        const userDataPath = app.getPath("userData");
        const sessionPath = path.join(userDataPath, "session.json");

        if (fs.existsSync(sessionPath)) {
          fs.unlinkSync(sessionPath);
        }
      } catch (error) {
        console.error("Failed to remove stored session:", error);
      }

      if (global.mainWindow) {
        global.mainWindow.webContents.send("auth-signout");
      }
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  private notifyAuthSuccess(user: any): void {
    // Send authentication success to renderer process
    if (global.mainWindow) {
      global.mainWindow.webContents.send("auth-success", {
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.user_metadata?.name || user?.email,
        },
      });
    }
  }
}

const authManager = new AuthManager();

export const handleAuthCallback = async (
  hashedToken: string
): Promise<void> => {
  console.log("Handling auth callback with hashed token");
  const result = await authManager.signInWithHashedToken(hashedToken);

  if (!result.success) {
    console.error("Authentication failed:", result.error);
    // You might want to show an error dialog here
  }
};

export const getCurrentUser = () => authManager.getCurrentUser();
export const signOut = () => authManager.signOut();
