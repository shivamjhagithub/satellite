from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AppError(Exception):
    status_code: int
    error_code: str
    message: str

    def __str__(self) -> str:
        return self.message
