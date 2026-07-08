from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers.auth import router as auth_router
from routers.agent import router as agent_router
from routers.file import router as file_router
from db.db_init import init_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_tables()
    print("=== FastAPI 服务启动 ===")
    yield
    print("=== FastAPI 服务关闭 ===")

app = FastAPI(title="Agent Knowledge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(file_router)

@app.get("/", summary="健康检查")
async def health_check():
    return {"code": 0, "message": "success", "data": "Agent Knowledge API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)