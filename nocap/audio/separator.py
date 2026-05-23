from __future__ import annotations

from dataclasses import dataclass

from nocap.i18n import msg
from nocap.audio.loader import AudioData


@dataclass(frozen=True)
class StemQuality:
    usable: bool
    vocal_rms_ratio: float
    active_ratio: float
    peak_ratio: float
    reason: str = ""


def separate(audio: AudioData, model_name: str = "htdemucs") -> AudioData:
    """Isolate vocals using Demucs. Returns a vocals-only AudioData."""
    try:
        import torch
        from demucs.pretrained import get_model
        from demucs.apply import apply_model
    except ImportError as e:
        raise ImportError(msg("separator.needDemucs")) from e

    import numpy as np
    import librosa

    model = get_model(model_name)
    model.eval()

    target_sr = model.samplerate
    y_resampled = librosa.resample(audio.y, orig_sr=audio.sr, target_sr=target_sr)

    # mono → stereo (C, T)
    if y_resampled.ndim == 1:
        wav = np.stack([y_resampled, y_resampled], axis=0)
    else:
        wav = y_resampled

    wav_tensor = torch.tensor(wav, dtype=torch.float32).unsqueeze(0)  # (1, C, T)

    with torch.no_grad():
        sources = apply_model(model, wav_tensor, device="cpu", progress=False)
    # sources shape: (1, num_sources, C, T)
    # model.sources is list like ['drums','bass','other','vocals']
    vocal_idx = model.sources.index("vocals")
    vocals = sources[0, vocal_idx]  # (C, T)

    vocals_np = vocals.mean(dim=0).numpy()  # stereo → mono
    vocals_np = librosa.resample(vocals_np, orig_sr=target_sr, target_sr=audio.sr)

    return AudioData(
        y=vocals_np.astype(np.float32),
        sr=audio.sr,
        duration=len(vocals_np) / audio.sr,
        path=audio.path,
    )


def assess_vocal_stem(vocals: AudioData, mix: AudioData) -> StemQuality:
    """Lightweight guard against clearly broken or near-empty vocal stems."""
    import numpy as np

    eps = 1e-9
    mix_y = np.asarray(mix.y, dtype=np.float32)
    vocals_y = np.asarray(vocals.y, dtype=np.float32)
    if mix_y.size == 0 or vocals_y.size == 0:
        return StemQuality(False, 0.0, 0.0, 0.0, msg("separator.emptyStem"))

    mix_rms = float(np.sqrt(np.mean(np.square(mix_y))) + eps)
    vocal_rms = float(np.sqrt(np.mean(np.square(vocals_y))) + eps)
    vocal_rms_ratio = vocal_rms / mix_rms

    mix_peak = float(np.max(np.abs(mix_y)) + eps)
    vocal_peak = float(np.max(np.abs(vocals_y)) + eps)
    peak_ratio = vocal_peak / mix_peak

    frame = max(256, int(vocals.sr * 0.05))
    active_ratio = _active_frame_ratio(vocals_y, frame, threshold=max(vocal_rms * 0.25, mix_rms * 0.015))

    if vocal_rms_ratio < 0.015:
        return StemQuality(False, vocal_rms_ratio, active_ratio, peak_ratio, msg("separator.tooQuiet"))
    if active_ratio < 0.015:
        return StemQuality(False, vocal_rms_ratio, active_ratio, peak_ratio, msg("separator.tooInactive"))
    if peak_ratio > 2.5 and active_ratio < 0.05:
        return StemQuality(False, vocal_rms_ratio, active_ratio, peak_ratio, msg("separator.spiky"))

    return StemQuality(True, vocal_rms_ratio, active_ratio, peak_ratio)


def _active_frame_ratio(y, frame: int, threshold: float) -> float:
    import numpy as np

    if y.size < frame:
        return float(np.sqrt(np.mean(np.square(y))) >= threshold)
    usable = y[:(y.size // frame) * frame]
    if usable.size == 0:
        return 0.0
    framed = usable.reshape(-1, frame)
    rms = np.sqrt(np.mean(np.square(framed), axis=1))
    return float(np.mean(rms >= threshold))


def is_available() -> bool:
    try:
        from demucs.pretrained import get_model  # noqa: F401
        return True
    except ImportError:
        return False
