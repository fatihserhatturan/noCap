# noCap — Hip-Hop Flow & Rhythm Analyzer: Tasarım Planı

## Context

noCap, bir hip-hop şarkısının "flow haritasını" çıkaran bir analiz aracı. Hedef: rapçinin vokallerini beat grid'e göre konumlandırarak hece yoğunluğu, kafiye şeması, senkopasyon ve stres örüntülerini görselleştirmek. Girdi olarak ses dosyası, düz metin lyrics ve/veya zaman damgalı lyrics (LRC/SRT) kabul eder; çıktı olarak Python CLI üzerinden başlatılan tarayıcı tabanlı interaktif bir flow haritası sunar.

---

## Proje Mimarisi

```
noCap/
├── nocap/                    # Ana Python paketi
│   ├── __init__.py
│   ├── cli.py               # Click tabanlı CLI giriş noktası
│   ├── audio/
│   │   ├── loader.py        # Ses dosyası yükleme (librosa)
│   │   ├── beat_tracker.py  # BPM ve beat grid tespiti
│   │   ├── transcriber.py   # Whisper ile otomatik transkripsiyon
│   │   └── separator.py     # Vokal/beat ayrımı (Demucs, opsiyonel)
│   ├── text/
│   │   ├── parser.py        # LRC/SRT/düz metin ayrıştırıcı
│   │   ├── syllables.py     # Hece sayımı ve stres analizi (CMU Dict)
│   │   └── rhyme.py         # Kafiye şeması tespiti (fonetik benzerlik)
│   ├── analysis/
│   │   ├── aligner.py       # Heceleri beat grid'e hizalama
│   │   ├── flow_metrics.py  # Yoğunluk, senkopasyon, tutarlılık metrikleri
│   │   └── exporter.py      # FlowMap JSON üretimi
│   └── web/
│       ├── server.py        # Python HTTP sunucusu (http.server veya Flask)
│       └── static/
│           ├── index.html   # Ana görselleştirme sayfası
│           ├── flowmap.js   # Piano-roll tarzı canvas renderer
│           ├── player.js    # Ses oynatıcı + beat sync
│           └── style.css
├── tests/
├── pyproject.toml
└── DESIGN.md
```

---

## Modüller ve Sorumluluklar

### 1. `nocap/audio/` — Ses İşleme

| Modül | Kütüphane | Görev |
|---|---|---|
| `loader.py` | librosa | MP3/WAV yükleme, mono dönüşüm, normalize |
| `beat_tracker.py` | librosa.beat | BPM tespiti, beat zamanları, bar grid hesaplama |
| `transcriber.py` | openai-whisper | Kelime düzeyinde zaman damgalı transkripsiyon |
| `separator.py` | demucs (opsiyonel) | Vokal izolasyonu, daha temiz transkripsiyon için |

**Çıktı:** Beat grid (`[{time, beat_no, bar_no}]`) + kelime zaman damgaları

---

### 2. `nocap/text/` — Metin Analizi

| Modül | Kütüphane | Görev |
|---|---|---|
| `parser.py` | — | LRC/SRT format ayrıştırma, düz metin → satır listesi |
| `syllables.py` | `syllables` / `nltk` + CMU Dict | Hece sayımı, vurgu (stressed/unstressed) tespiti |
| `rhyme.py` | `pronouncing` (CMU) | Son hece fonetik eşleştirme, kafiye grubu etiketleme |

**Çıktı:** Her kelime için `{text, syllable_count, stress_pattern, rhyme_group}`

---

### 3. `nocap/analysis/` — Flow Analizi

**`aligner.py`** — Heceleri beat grid üzerine konumlandırır:
- Ses + lyrics girdi varsa: Whisper zaman damgaları → beat pozisyonu
- Sadece lyrics + timestamp: LRC zamanları → beat pozisyonu
- Sadece düz metin: Eşit dağılım tahmini (yaklaşık mod)

**`flow_metrics.py`** — Hesaplanan metrikler:
- **Hece Yoğunluğu** (syllables/beat): Bar bazında ve şarkı geneli
- **Beat Pozisyonu** (0.0–1.0): Vuruşa göre erken/geç/tam isabet
- **Senkopasyon Skoru**: Off-beat hecelerin oranı
- **Kafiye Zinciri Uzunluğu**: Art arda gelen kafiye grubu derinliği
- **Flow Tutarlılığı**: Bar-to-bar yoğunluk varyansı

**`exporter.py`** — Standart FlowMap JSON üretir:
```json
{
  "metadata": {"title": "", "bpm": 0, "duration": 0},
  "beats": [{"time": 0.0, "beat_no": 1, "bar_no": 1}],
  "syllables": [{"text": "", "time": 0.0, "beat_pos": 0.25, "stress": true, "rhyme_group": "A"}],
  "bars": [{"bar_no": 1, "density": 4.5, "syncopation": 0.3}],
  "rhyme_chains": [{"group": "A", "syllables": []}],
  "summary": {"avg_density": 0, "syncopation_score": 0, "consistency": 0}
}
```

---

### 4. `nocap/web/` — İnteraktif Görselleştirme

**Python HTTP sunucusu** (`python -m http.server` veya minimal Flask):
- CLI komutu analizi tamamlayınca `flowmap.json` dosyasını üretir
- Tarayıcıyı otomatik açar (`webbrowser.open`)
- Statik dosyalar + JSON servis eder

**Görselleştirme bileşenleri (Canvas/SVG tabanlı):**

```
┌─────────────────────────────────────────────────────┐
│  noCap Flow Map — "şarkı adı"  BPM: 92             │
├──────┬─────────────────────────────────────────────┤
│      │  1   +   2   +   3   +   4   +              │
│ Bar1 │  ██  ██  ░░  ██  ██  ░░  ██  ░░  ...       │ ← hece blokları
│ Bar2 │  ░░  ██  ██  ░░  ██  ██  ░░  ██  ...       │   renk = kafiye grubu
│ Bar3 │  ██  ░░  ██  ██  ░░  ████░░  ░░  ...       │   yoğunluk = blok boyu
├──────┴─────────────────────────────────────────────┤
│ [▶ Play]  Timeline: ████░░░░░░░░░░░░ 0:12 / 0:48  │
├─────────────────────────────────────────────────────┤
│ Kafiye: A=mavi B=kırmızı C=yeşil                   │
│ Density: Bar1=4.2  Bar2=5.1  Bar3=3.8 syl/beat     │
└─────────────────────────────────────────────────────┘
```

**İnteraktif özellikler:**
- Ses oynatıcı: playhead beat grid ile senkronize ilerler
- Bar üzerine hover: o barın metrikleri tooltip olarak görünür
- Hece bloğu üzerine hover: kelime, fonetik, stres bilgisi
- Kafiye grubu filtresi: belirli kafiye zincirini highlight et
- Zoom: yatay eksende bar aralığını genişlet/daralt

---

## CLI Arayüzü

```bash
# Ses dosyasından tam analiz (Whisper transkripsiyon dahil)
nocap analyze track.mp3

# Düz metin lyrics ile analiz (beat yaklaşık)
nocap analyze track.mp3 --lyrics lyrics.txt

# Zaman damgalı lyrics ile analiz (LRC/SRT)
nocap analyze track.mp3 --lyrics track.lrc

# Sadece lyrics (ses yok, beat tahmini yapılır)
nocap analyze --lyrics lyrics.lrc --bpm 90

# JSON çıktı al, görselleştirme açma
nocap analyze track.mp3 --output flowmap.json --no-serve

# Var olan JSON'ı görselleştir
nocap serve flowmap.json --port 8080
```

---

## Bağımlılıklar

```toml
[project]
name = "nocap"
dependencies = [
  "librosa>=0.10",             # Ses yükleme + beat tespiti
  "openai-whisper>=20231117",  # Otomatik transkripsiyon
  "pronouncing>=0.2",          # CMU pronouncing dictionary (kafiye)
  "syllables>=1.0",            # Hece sayımı
  "click>=8.0",                # CLI framework
  "numpy>=1.24",
  "flask>=3.0",                # Web sunucusu (opsiyonel, http.server fallback)
]

[project.optional-dependencies]
separator = ["demucs>=4.0"]    # Vokal izolasyonu (ağır bağımlılık, opsiyonel)
```

---

## Geliştirme Fazları

### Faz 1 — Temel Pipeline (MVP)
- [ ] `audio/loader.py` + `audio/beat_tracker.py`
- [ ] `text/parser.py` (LRC/SRT + düz metin)
- [ ] `text/syllables.py` + `text/rhyme.py`
- [ ] `analysis/aligner.py` (timestamp → beat pozisyonu)
- [ ] `analysis/flow_metrics.py` (temel metrikler)
- [ ] `analysis/exporter.py` (FlowMap JSON)
- [ ] `cli.py` (temel `analyze` komutu)

### Faz 2 — Görselleştirme
- [ ] `web/server.py` + statik dosya yapısı
- [ ] Piano-roll canvas renderer (`flowmap.js`)
- [ ] Ses oynatıcı + beat sync (`player.js`)
- [ ] Hover tooltip ve kafiye highlight

### Faz 3 — Whisper Entegrasyonu
- [ ] `audio/transcriber.py` (kelime düzeyinde timestamp)
- [ ] Transkripsiyon → lyrics otomatik hizalama
- [ ] `audio/separator.py` (demucs ile vokal izolasyonu, opsiyonel)

### Faz 4 — Gelişmiş Metrikler
- [ ] Multi-bar karşılaştırma görünümü
- [ ] Rapçi bazlı istatistik profili (birden fazla şarkı)
- [ ] PNG/SVG export butonu

---

## Doğrulama

1. `nocap analyze tests/fixtures/sample.mp3` — beat grid ve JSON üretilmeli
2. `nocap analyze --lyrics tests/fixtures/sample.lrc --bpm 90` — ses olmadan flow hesaplanmalı
3. Tarayıcıda piano-roll'un beat sayısı BPM × süre ile eşleşmeli
4. Playhead ilerlerken ilgili bar/hece highlight olmalı
5. `pytest tests/` — birim testler geçmeli
