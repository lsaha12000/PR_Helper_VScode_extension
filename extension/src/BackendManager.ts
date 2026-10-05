import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

export class BackendManager {
  private proc: cp.ChildProcess | null = null;
  port: number | null = null;

  async start(extensionPath: string): Promise<void> {
    const backendDir = path.join(extensionPath, "..", "backend");
    const mainPy = path.join(backendDir, "main.py");

    return new Promise((resolve, reject) => {
      this.proc = cp.spawn("python", [mainPy], {
        cwd: backendDir,
        env: process.env,
      });

      const timeout = setTimeout(() => reject(new Error("Backend startup timed out")), 15_000);

      this.proc.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        const match = line.match(/READY:PORT=(\d+)/);
        if (match) {
          this.port = parseInt(match[1], 10);
          clearTimeout(timeout);
          resolve();
        }
      });

      this.proc.stderr?.on("data", (data: Buffer) => {
        console.error("[PR Helper backend]", data.toString());
      });

      this.proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start backend: ${err.message}. Make sure Python 3.9+ is installed.`));
      });

      this.proc.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Backend exited with code ${code}`));
        }
      });
    });
  }

  async waitReady(maxAttempts = 20): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`);
        if (res.ok) return;
      } catch {
        /* not ready yet */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("Backend health check failed");
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
    this.port = null;
  }
}
