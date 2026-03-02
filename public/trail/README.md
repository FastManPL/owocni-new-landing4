# Zdjęcia tła hero (trail)

Sekcja hero ładuje obrazy z URL: `/trail/{klucz}_strrona_internetowa{_RETINA}.{avif|webp}`

**Wzorzec nazw (manifest hero):**
- Grupy: A1–A4, B1–B4, C1–C4, D1–D4 (16 unikalnych kluczy)
- Przykład 1x: `A1_strrona_internetowa.avif`, `A1_strrona_internetowa.webp`
- Retina (DPR≥2): `A1_strrona_internetowa_RETINA.avif`, `A1_strrona_internetowa_RETINA.webp`

**Skrypt do kopiowania z dowolnego katalogu:**

Jeśli masz zdjęcia w innym folderze (np. `KATALOG`), możesz je skopiować z automatycznym nazewnictwem:

```bash
node scripts/copy-trail-images.js <katalog_źródłowy>
```

Obsługiwane konwencje w źródle:
- Już poprawne: `A1_strrona_internetowa.avif` → kopiuj 1:1
- Krótkie: `A1.avif`, `A1.webp` → kopiuj jako `A1_strrona_internetowa.avif`
- Numerowane: `01.avif` … `16.avif` → mapowanie na A1…D4

Bez plików sekcja pokaże placeholdery / puste miejsca.
