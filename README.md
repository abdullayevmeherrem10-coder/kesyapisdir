# Kəsyapışdır

**Kəsyapışdır** — Azərbaycan dilində masaüstü video redaktorudur. Çoxtrekli zaman xətti, keçidlər, maska və xroma açarı, rötuş, animasiya, mətn və stikerlər, kamera/ekran/mikrofon yazısı, qapaq (üz şəkli) və MP4/WebM ixracı var. Əlavə proqram (FFmpeg və s.) tələb etmir: video emalı Chromium mühərriki (Canvas, Web Audio, MediaRecorder) ilə aparılır.

## Quraşdırma və başlatma

Tələb: [Node.js](https://nodejs.org) 18 və ya daha yeni.

```
npm install
npm start
```

Windows-da **Başlat.cmd** faylına iki dəfə klikləmək kifayətdir (ilk dəfə Electron-u özü yükləyir). Electron olmadan brauzerdə işlətmək üçün **Brauzerdə başlat.cmd** (`npm run web`, `http://localhost:5173`). Brauzer rejimində ekran yazısı və fayl yolu funksiyaları məhdud ola bilər.

## İnterfeys

| Sahə | Məzmun |
|---|---|
| Menyu zolağı | Fayl, Redaktə, Oynat, Parametrlər, İxrac, Kömək |
| Sol panel | İdxal (idxal / layihə faylları / arxa fonlar), Səs, Mətn, Keçidlər, Effektlər, Elementlər, Alətlər, Xüsusiyyətlər |
| Önizləmə | Kanvas, sürüşdürmə zolağı, oynatma düymələri, nisbət, səs, tam ekran, layihə parametrləri |
| Zaman xətti | Alət paneli, Qapaq düyməsi, treklər (göstər/gizlət, səssiz), xətkeş, səs səviyyəsi göstəricisi (L/R, dB) |
| Status zolağı | Layihə uzunluğu, seçilmiş klip |

## Funksiyalar

| Bölmə | İmkanlar |
|---|---|
| Layihə | 16:9, 9:16, 1:1, 4:3, 21:9; 24/25/30/60 fps; arxa fon rəngi; bulanıq fon; qapaq (üz şəkli) |
| Media | Video, şəkil, audio idxalı (düymə, sürüklə-burax, bütöv qovluq); İdxal panelində axtarış və sıralama; kateqoriya və axtarışla "Layihə faylları"; hazır arxa fonlar; kamera, ekran (sistem səsi ilə) və mikrofon yazısı |
| Zaman xətti | Çoxtrekli; sürüklə, kənarı çəkərək qısalt (canlı önizləmə və müddət ipucu ilə), böl (Ctrl+B), kopyala/kəs/yapışdır (Ctrl+C/X/V), dublikat, qrup seçimi; səs dalğası video və audio kliplərdə; seçilmiş klipdə səs xətti (səviyyə, aydınlanma/qaralma dairələri); klipə klik başlığı ora gətirir; siçanı izləyən ağ xətt; maqnit; miqyas; sağ klik menyuları; trekləri sırala/adlandır |
| Keçidlər | 28 keçid, 4 kateqoriya (Əsas, Hərəkət, Silmə, Effektlər), canlı önizləmə, müddət tənzimi |
| Video → Əsas | Ölçü (sabit nisbət), mövqe X/Y, fırlatma, 6 düzləndirmə düyməsi, sığdır/doldur, üfüqi çevirmə, şəffaflıq, qarışdırma rejimləri |
| Video → Arxa fonu sil | Xroma açarı (yaşıl/mavi fon): rəng, pipet, həssaslıq, kənar yumşaqlığı |
| Video → Maska | Düzbucaqlı, dairə, xətti, ürək, ulduz; ölçü, kənar yumşaqlığı, mövqe, tərs çevirmə |
| Video → Rötuş | Pürüzsüzləşdir, ağartma, aydınlıq, istilik |
| Səs | Səviyyə (dB), aydınlanma/qaralma, normallaşdırma, səssiz, tonu saxla; videodan səsi ayır (ayrıca audio klip); GB-lıq videolarda da səs dalğası |
| Sürət | 0.1×–10× (loqarifmik sürgü + hazır dəyərlər), tonu saxla |
| Animasiya | Giriş və çıxış: solma, 4 istiqamətdə sürüşmə, böyümə, kiçilmə, fırlanma, sıçrayış; müddət |
| Tənzimlə | Parlaqlıq, kontrast, doyğunluq, temperatur, rəng çaları, boz, sepia, bulanıqlıq, vinyet; 12 hazır filtr |
| Mətn | Çoxsətirli, 15 şrift, ölçü, rəng, fon, kontur, kölgə, hərf aralığı, düzləndirmə, 8 hazır üslub; 60 stiker |
| Qapaq | Videodan kadr seç və ya şəkil yüklə; ixracda ilk kadr kimi; PNG kimi saxla |
| İxrac | MP4 (H.264+AAC) və ya WebM; tam/2/3/yarım ölçü; 24–60 fps; 4–30 Mbit/s |
| Layihə faylı | `.ksy` (JSON) yadda saxla/aç; media faylları yenidən bağlama; avtomatik ehtiyat nüsxə |

## Qısayollar

| Düymə | Əməliyyat |
|---|---|
| Boşluq | Oynat / dayandır |
| Ctrl+B | Oynatma başlığında böl |
| Q / W | Başlıqdan klipin sol / sağ tərəfini kəs |
| Delete | Seçilmişi sil |
| Ctrl+C / Ctrl+X / Ctrl+V | Kopyala / kəs / oynatma başlığına yapışdır |
| Ctrl+D | Dublikat |
| Ctrl+A | Hamısını seç |
| Ctrl+Z / Ctrl+Y | Geri / irəli |
| Ctrl+N / Ctrl+O / Ctrl+S | Yeni layihə / aç / yadda saxla |
| Ctrl+I / Ctrl+T | Media əlavə et / mətn əlavə et |
| Ctrl+E | İxrac |
| ← / → | Bir kadr (Shift ilə 1 saniyə) |
| Home / End | Başa / sona |
| F | Zaman xəttini sığdır |
| + / − | Miqyas |
| Esc | Seçimi və menyuları bağla |

## Qovluq quruluşu

```
Kəsyapışdır/
├─ main.js              Electron əsas prosesi (pəncərə, ekran yazısı icazəsi, smoke test)
├─ preload.js           Renderer üçün körpü
├─ server.js            Brauzer rejimi üçün statik server
├─ build/               icon.ico / icon.png (pəncərə və quraşdırıcı ikonu)
├─ app/
│  ├─ assets/           Loqo şəkilləri (logo-32…512.png)
│  ├─ index.html        İnterfeys və SVG ikon toplusu
│  ├─ css/style.css     Mövzu
│  └─ js/
│     ├─ state.js       Layihə modeli, tarixçə, seçim, yadda saxla/yüklə
│     ├─ media.js       İdxal, miniatürlər, səs pikləri, kitabxana
│     ├─ transitions.js Keçidlər
│     ├─ renderer.js    Kompozitor: kliplər, keçidlər, maska, xroma, rötuş, animasiya, səs qrafı
│     ├─ timeline.js    Zaman xətti
│     ├─ inspector.js   Xüsusiyyətlər paneli
│     ├─ exporter.js    İxrac
│     ├─ recorder.js    Kamera / ekran / mikrofon yazısı
│     ├─ cover.js       Qapaq
│     └─ app.js         Menyular, panellər, qısayollar, dialoqlar
└─ test/                npm run smoke
```

## Məhdudiyyətlər

- İxrac real vaxtda gedir (1 dəqiqəlik video təxminən 1 dəqiqə). İxrac zamanı pəncərəni kiçiltməyin.
- `.ksy` faylı media fayllarının özünü saxlamır; layihəni açanda eyni adlı faylları yenidən seçmək lazım gəlir.
- Rötuş bütün kadra tətbiq olunur (üz tanıma yoxdur). Arxa fon silmə xroma açarı ilə işləyir, yəni yaşıl/mavi fon tələb edir.
- Dəstəklənən formatlar Chromium-un oxuya bildiyi formatlardır (MP4/H.264, WebM, MP3, WAV, PNG, JPG və s.).

## Test

```
npm run smoke
```

Proqramı açır, sintetik layihə qurur (şəkil, səs, mətn, keçid, maska, animasiya, rötuş), üç ekran şəklini `test/out/` qovluğuna yazır, qapaqlı MP4 ixrac edir və xətaları `test/out/report.txt` faylında göstərir.
