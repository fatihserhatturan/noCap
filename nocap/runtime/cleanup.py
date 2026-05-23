from __future__ import annotations

import gc
from importlib import import_module


def release_heavy_resources() -> None:
    """Best-effort cleanup after audio analysis finishes."""
    _clear_torch()
    _clear_librosa_cache()
    gc.collect()


def _clear_torch() -> None:
    try:
        torch = import_module("torch")
    except ImportError:
        return
    try:
        if hasattr(torch, "cuda") and torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass
    try:
        if hasattr(torch, "mps") and torch.backends.mps.is_available():
            torch.mps.empty_cache()
    except Exception:
        pass


def _clear_librosa_cache() -> None:
    try:
        librosa = import_module("librosa")
    except ImportError:
        return
    cache = getattr(librosa, "cache", None)
    clear = getattr(cache, "clear", None)
    if callable(clear):
        try:
            clear()
        except Exception:
            pass
