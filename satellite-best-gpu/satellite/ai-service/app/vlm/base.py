from __future__ import annotations

from abc import ABC, abstractmethod


class VisionLanguageModel(ABC):
    @abstractmethod
    def is_loaded(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def load(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def caption(self, image_bytes: bytes, prompt: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def answer(self, image_bytes: list[bytes], question: str) -> str:
        raise NotImplementedError
