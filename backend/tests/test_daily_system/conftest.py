"""Shared fixtures for Daily System tests.

A trimmed copy of `test_tasks.conftest.FakeSupabase` adjusted for two
quirks of `daily_log_service`:

* `.upsert(record_dict, on_conflict=...)` is called with a single dict
  (not a list) — real supabase-py accepts both shapes; the fake here
  normalises the payload so the call matches behaviour.
* `.order(key, desc=True)` against `used_at` timestamps must produce
  newest-first ordering (the cooldown logic depends on it).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest


@dataclass
class _Result:
    data: list[dict[str, Any]]


class _Filters:
    def __init__(self) -> None:
        self.eqs: list[tuple[str, Any]] = []
        self.gtes: list[tuple[str, Any]] = []
        self.ltes: list[tuple[str, Any]] = []
        self.limit_: int | None = None

    def matches(self, row: dict[str, Any]) -> bool:
        for k, v in self.eqs:
            if row.get(k) != v:
                return False
        for k, v in self.gtes:
            rv = row.get(k)
            if rv is None or str(rv) < str(v):
                return False
        for k, v in self.ltes:
            rv = row.get(k)
            if rv is None or str(rv) > str(v):
                return False
        return True

    def slice(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if self.limit_ is not None:
            return rows[: self.limit_]
        return rows


class _Query:
    def __init__(self, table_name: str, store: dict[str, list[dict[str, Any]]]) -> None:
        self._name = table_name
        self._store = store
        self._filters = _Filters()
        self._mode: str | None = None
        self._payload: Any = None
        self._upsert_conflict: str | None = None
        self._order: tuple[str, bool] | None = None

    def select(self, *_a: Any, **_kw: Any) -> _Query:
        self._mode = self._mode or "select"
        return self

    def eq(self, key: str, value: Any) -> _Query:
        self._filters.eqs.append((key, value))
        return self

    def gte(self, key: str, value: Any) -> _Query:
        self._filters.gtes.append((key, value))
        return self

    def lte(self, key: str, value: Any) -> _Query:
        self._filters.ltes.append((key, value))
        return self

    def order(self, key: str, desc: bool = False) -> _Query:
        self._order = (key, desc)
        return self

    def limit(self, n: int) -> _Query:
        self._filters.limit_ = n
        return self

    def insert(self, record: dict[str, Any] | list[dict[str, Any]]) -> _Query:
        self._mode = "insert"
        self._payload = record if isinstance(record, list) else [record]
        return self

    def update(self, patch: dict[str, Any]) -> _Query:
        self._mode = "update"
        self._payload = patch
        return self

    def delete(self) -> _Query:
        self._mode = "delete"
        return self

    def upsert(
        self,
        rows: dict[str, Any] | list[dict[str, Any]],
        on_conflict: str | None = None,
    ) -> _Query:
        self._mode = "upsert"
        self._payload = rows if isinstance(rows, list) else [rows]
        self._upsert_conflict = on_conflict
        return self

    def execute(self) -> _Result:
        rows = self._store[self._name]
        if self._mode == "insert":
            inserted_rows: list[dict[str, Any]] = []
            for incoming in self._payload:
                row = {**incoming}
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", "2026-05-06T08:00:00+00:00")
                rows.append(row)
                inserted_rows.append(row)
            return _Result(data=inserted_rows)

        if self._mode == "update":
            touched = [r for r in rows if self._filters.matches(r)]
            for r in touched:
                r.update(self._payload)
            return _Result(data=touched)

        if self._mode == "delete":
            kept, removed = [], []
            for r in rows:
                (removed if self._filters.matches(r) else kept).append(r)
            rows[:] = kept
            return _Result(data=removed)

        if self._mode == "upsert":
            conflict_keys = (
                [k.strip() for k in (self._upsert_conflict or "").split(",")]
                if self._upsert_conflict
                else []
            )
            out: list[dict[str, Any]] = []
            for incoming in self._payload:
                matched = False
                if conflict_keys:
                    for r in rows:
                        if all(r.get(k) == incoming.get(k) for k in conflict_keys):
                            r.update(incoming)
                            out.append(r)
                            matched = True
                            break
                if matched:
                    continue
                new = {**incoming}
                new.setdefault("id", str(uuid.uuid4()))
                new.setdefault("created_at", "2026-05-06T08:00:00+00:00")
                rows.append(new)
                out.append(new)
            return _Result(data=out)

        # select
        filtered = [r for r in rows if self._filters.matches(r)]
        if self._order:
            key, desc = self._order
            try:
                filtered.sort(key=lambda r: r.get(key) or "", reverse=desc)
            except TypeError:
                pass
        return _Result(data=self._filters.slice(filtered))


@dataclass
class FakeSupabase:
    tables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def table(self, name: str) -> _Query:
        self.tables.setdefault(name, [])
        return _Query(name, self.tables)


USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase(
        tables={
            "users": [{"id": USER_ID}],
            "daily_logs": [],
            "stamina_boosts": [],
            "daily_tasks": [],
        }
    )
