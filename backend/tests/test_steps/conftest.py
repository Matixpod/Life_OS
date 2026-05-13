"""Shared fixtures for Steps Module tests.

Reuses the FakeSupabase from test_daily_system but pre-seeds the
`step_logs`, `users`, and `cardio_sessions` tables that the steps
service touches.
"""

from __future__ import annotations

import pytest

from tests.test_daily_system.conftest import USER_ID, FakeSupabase


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase(
        tables={
            "users": [{"id": USER_ID, "weekly_step_goal": 70000}],
            "step_logs": [],
            "cardio_sessions": [],
        }
    )


__all__ = ["USER_ID", "FakeSupabase", "fake_supabase"]
