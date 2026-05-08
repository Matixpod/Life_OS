import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    ai_settings,
    ares,
    calendar,
    cognitive,
    daily_system,
    dashboard,
    goals,
    habits,
    health,
    intelligence,
    kronos,
    mental_health,
    projects_v2,
    prometheus,
    proposals,
    review,
    sleep,
    tasks,
    user,
    workout,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Life OS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(user.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(sleep.router, prefix="/api/v1")
app.include_router(workout.router, prefix="/api/v1")
app.include_router(mental_health.router, prefix="/api/v1")
app.include_router(cognitive.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(review.router, prefix="/api/v1")
app.include_router(goals.router, prefix="/api/v1")
app.include_router(kronos.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(ai_settings.router, prefix="/api/v1")
app.include_router(ares.router, prefix="/api/v1")
app.include_router(habits.router, prefix="/api/v1")
app.include_router(projects_v2.router, prefix="/api/v1")
app.include_router(proposals.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(daily_system.router, prefix="/api/v1")
app.include_router(prometheus.router, prefix="/api/v1")
