from __future__ import annotations

from nocap.audio.loader import AudioData


def separate(audio: AudioData, model_name: str = "htdemucs") -> AudioData:
    """Isolate vocals using Demucs. Returns a vocals-only AudioData."""
    try:
        import torch
        from demucs.pretrained import get_model
        from demucs.apply import apply_model
    except ImportError as e:
        raise ImportError("demucs is required: pip install demucs") from e

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


def is_available() -> bool:
    try:
        from demucs.pretrained import get_model  # noqa: F401
        return True
    except ImportError:
        return False
