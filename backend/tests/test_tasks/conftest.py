"""Shared fixtures for Task System tests.

Extends the KRONOS `FakeSupabase` pattern with the supabase-py methods
`task_service` actually invokes (`update`, `delete`, `upsert`, `is_`,
`range`). Same in-memory dict-of-lists store, no real network.
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
    """Captures `.eq/.gte/.lte/.is_/.range` so terminal verbs apply them."""

    def __init__(self) -> None:
        self.eqs: list[tuple[str, Any]] = []
        self.gtes: list[tuple[str, Any]] = []
        self.ltes: list[tuple[str, Any]] = []
        self.is_nulls: list[str] = []
        self.range_: tuple[int, int] | None = None
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
        for k in self.is_nulls:
            if row.get(k) is not None:
                return False
        return True

    def slice(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if self.range_ is not None:
            lo, hi = self.range_
            return rows[lo : hi + 1]
        if self.limit_ is not None:
            return rows[: self.limit_]
        return rows


class _Query:
    """A chainable query bound to a single underlying table list.

    Mutating writes (`insert`/`update`/`upsert`/`delete`) operate on the
    list reference stored in the parent `FakeSupabase.tables` so the test
    can inspect the state afterwards.
    """

    def __init__(self, table_name: str, store: dict[str, list[dict[str, Any]]]) -> None:
        self._name = table_name
        self._store = store
        self._filters = _Filters()
        self._mode: str | None = None
        self._payload: Any = None
        self._upsert_conflict: str | None = None

    # ─── select chain ───
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

    def is_(self, key: str, value: str) -> _Query:
        if value == "null":
            self._filters.is_nulls.append(key)
        else:
            self._filters.eqs.append((key, value))
        return self

    def order(self, _key: str, desc: bool = False) -> _Query:
        try:
            self._store[self._name].sort(key=lambda r: r.get(_key) or "", reverse=desc)
        except TypeError:
            pass
        return self

    def range(self, lo: int, hi: int) -> _Query:
        self._filters.range_ = (lo, hi)
        return self

    def limit(self, n: int) -> _Query:
        self._filters.limit_ = n
        return self

    # ─── write modes ───
    def insert(self, record: dict[str, Any]) -> _Query:
        self._mode = "insert"
        self._payload = record
        return self

    def update(self, patch: dict[str, Any]) -> _Query:
        self._mode = "update"
        self._payload = patch
        return self

    def delete(self) -> _Query:
        self._mode = "delete"
        return self

    def upsert(self, rows: list[dict[str, Any]], on_conflict: str | None = None) -> _Query:
        self._mode = "upsert"
        self._payload = rows
        self._upsert_conflict = on_conflict
        return self

    # ─── terminal ───
    def execute(self) -> _Result:
        rows = self._store[self._name]
        match self._mode:
            case "insert":
                inserted = {**self._payload}
                inserted.setdefault("id", str(uuid.uuid4()))
                inserted.setdefault("created_at", "2026-04-29T08:00:00Z")
                rows.append(inserted)
                return _Result(data=[inserted])

            case "update":
                touched: list[dict[str, Any]] = []
                for r in rows:
                    if self._filters.matches(r):
                        r.update(self._payload)
                        touched.append(r)
                return _Result(data=touched)

            case "delete":
                kept: list[dict[str, Any]] = []
                deleted: list[dict[str, Any]] = []
                for r in rows:
                    (deleted if self._filters.matches(r) else kept).append(r)
                rows[:] = kept
                return _Result(data=deleted)

            case "upsert":
                conflict_keys = (
                    [k.strip() for k in (self._upsert_conflict or "").split(",")]
                    if self._upsert_conflict
                    else []
                )
                out: list[dict[str, Any]] = []
                for incoming in self._payload:
                    if conflict_keys:
                        matched = False
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
                    rows.append(new)
                    out.append(new)
                return _Result(data=out)

            case _:  # select
                filtered = [r for r in rows if self._filters.matches(r)]
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
    """A FakeSupabase pre-seeded with the single user row + empty task table."""
    return FakeSupabase(
        tables={
            "users": [{"id": USER_ID}],
            "daily_tasks": [],
            "kronos_streaks": [],
        }
    )
