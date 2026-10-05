import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import git, ado, pr, analyze

app = FastAPI(title="PR Helper Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(git.router, prefix="/git")
app.include_router(ado.router, prefix="/ado")
app.include_router(pr.router, prefix="/pr")
app.include_router(analyze.router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    # Port 0 = OS picks a free port; uvicorn prints the actual port to stdout.
    # BackendManager.ts reads the "READY:PORT=<n>" line to discover it.
    import socket

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]

    print(f"READY:PORT={port}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
