"""XP scoring for task completion.

Isolated in its own module so the formula is easy to tune later without
touching the service layer. All bonuses are additive percentages on the
base XP. Final XP is rounded up to the nearest integer.

Formula (per Phase 3 of CHECKLIST.md):
    base       low=10, medium=25, high=50
    early_bird +20%   when completed before 12:00 local time
    on_schedule +30%  when completed_at date == scheduled_date
    streak     +15%   when active streak >= 3 days

The CHECKLIST and PROMPT disagreed on whether `on_schedule` requires
high priority. We follow the CHECKLIST (no priority qualifier) so the
Phase 8 test `test_xp_on_schedule_bonus` passes as written.
"""

import math
from datetime import datetime

from models.task_models import Task, TaskPriority

_BASE_XP: dict[TaskPriority, int] = {
    TaskPriority.LOW: 10,
    TaskPriority.MEDIUM: 25,
    TaskPriority.HIGH: 50,
}

_EARLY_BIRD_HOUR = 12
_EARLY_BIRD_BONUS = 0.20
_ON_SCHEDULE_BONUS = 0.30
_STREAK_BONUS = 0.15
_STREAK_THRESHOLD = 3


def _to_local(dt: datetime) -> datetime:
    """Convert a stored datetime to local-clock datetime.

    `completed_at` is stored as UTC (timezone-aware) by the service;
    `astimezone()` with no arg converts to the system local timezone,
    which is what the user perceives as "before noon".
    """
    return dt.astimezone() if dt.tzinfo else dt


def compute_xp(task: Task, streak: int) -> tuple[int, list[str]]:
    """Return `(final_xp, bonus_reasons)` for a completed task.

    `streak` is the current per-category streak length the user had at
    the moment of completion. Pass 0 when summarizing past completions
    where the at-time streak is not known — callers tolerate this since
    the streak fact is point-in-time and cannot be reconstructed from
    the task row alone.
    """
    base = _BASE_XP[task.priority]
    multiplier = 1.0
    reasons: list[str] = []

    if task.completed_at is not None:
        local = _to_local(task.completed_at)
        if local.hour < _EARLY_BIRD_HOUR:
            multiplier += _EARLY_BIRD_BONUS
            reasons.append("early_bird")

        if task.scheduled_date is not None and local.date() == task.scheduled_date:
            multiplier += _ON_SCHEDULE_BONUS
            reasons.append("on_schedule")

    if streak >= _STREAK_THRESHOLD:
        multiplier += _STREAK_BONUS
        reasons.append("streak_bonus")

    return math.ceil(base * multiplier), reasons
