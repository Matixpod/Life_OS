"""Shared fixtures for KRONOS tests — in-memory Supabase fake."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest


@dataclass
class _Result:
    data: list[dict[str, Any]]


class _FakeQuery:
    """Minimal supabase-py query chain that supports the calls KRONOS makes:
    .select(...).eq(k,v).gte(k,v).lte(k,v).limit(n).order(...).execute()
    """

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def select(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        return self

    def eq(self, key: str, value: Any) -> _FakeQuery:
        return _FakeQuery([r for r in self._rows if r.get(key) == value])

    def gte(self, key: str, value: Any) -> _FakeQuery:
        return _FakeQuery(
            [r for r in self._rows if r.get(key) is not None and str(r[key]) >= str(value)]
        )

    def lte(self, key: str, value: Any) -> _FakeQuery:
        return _FakeQuery(
            [r for r in self._rows if r.get(key) is not None and str(r[key]) <= str(value)]
        )

    def limit(self, n: int) -> _FakeQuery:
        return _FakeQuery(self._rows[:n])

    def order(self, _key: str, desc: bool = False) -> _FakeQuery:
        # Best-effort sort; key may not always be present so we tolerate it.
        try:
            sorted_rows = sorted(
                self._rows,
                key=lambda r: r.get(_key) or "",
                reverse=desc,
            )
        except TypeError:
            sorted_rows = list(self._rows)
        return _FakeQuery(sorted_rows)

    def insert(self, record: dict[str, Any]) -> _FakeQuery:
        # Mutate underlying rows so the test can inspect inserts.
        record = {**record, "id": f"fake-id-{len(self._rows) + 1}"}
        self._rows.append(record)
        return _FakeQuery([record])

    def execute(self) -> _Result:
        return _Result(data=list(self._rows))


@dataclass
class FakeSupabase:
    """In-memory stand-in for a supabase.Client used by KRONOS analyzers."""

    tables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self.tables.setdefault(name, []))


USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    """A FakeSupabase pre-seeded with a single user row."""
    return FakeSupabase(tables={"users": [{"id": USER_ID}]})
