# BRIEF DLA DEVELOPERA — BRIDGE `FAKTY → KINETIC`

## Status dokumentu
Roboczy dokument integracyjno-architektoniczny przygotowany **przed analizą końcówki `KINETIC → Block 4`**.

Cel dokumentu:
- zebrać wszystko, co wiemy dziś o początku przejścia,
- nie zgubić decyzji, które już zapadły,
- dać developerowi **konkretny plan integracji**,
- zostawić miejsce na późniejsze potwierdzenie, że początek nie gryzie się z końcem.

---

# 1. Najważniejszy wniosek

## `FAKTY` i `KINETIC` NIE powinny być integrowane jako dwie zwykłe sekcje jedna pod drugą.

Dla tego konkretnego pairingu właściwy model to:

- **jeden wrapper bridge**,
- **dwie warstwy**,
- **jeden wspólny progress scrolla**,
- overlap pomiędzy końcówką `FAKTY` i początkiem `KINETIC`.

Powód jest prosty:

### `FAKTY`
- content siedzi wysoko / centralnie,
- na dole jest dużo oddechu,
- tło jest transparentne,
- sekcja wizualnie „kończy się” zanim wypełni cały dół ekranu.

### `KINETIC`
- ma pustą strefę wejściową u góry,
- pierwszy właściwy content rodzi się od centrum / dołu,
- tło startuje z tego samego jasnego świata `#f7f6f4`,
- jej intro wygląda tak, jakby było przygotowane do zszycia z czymś nad nią.

### Konsekwencja
Jeśli sekcje staną po prostu jedna pod drugą, pojawia się ryzyko:
- pustego dołu w `FAKTY`,
- pustej górnej fazy `KINETIC`,
- odczucia dwóch pustych ekranów zamiast jednego płynnego przejścia.

Czyli: **semantycznie to nie jest następstwo sekcji. To jest jedna choreografia przejścia.**

---

# 2. Co wiemy na pewno z kodu

## 2.1. Fakty
Obecna sekcja `FAKTY` ma:
- `min-height: 100vh`,
- układ centrowany (`display:flex`, `justify-content:center`),
- `background: transparent`,
- warstwy:
  - `#fakty-tunnel` — canvas tła,
  - `#fakty-dom` — właściwy DOM liter,
  - `#organic-overlay` — canvas overlay z blendem.

Dodatkowo standalone `FAKTY`:
- bootują się przez `DOMContentLoaded`,
- same tworzą własne ScrollTriggery,
- mają własny resize path,
- zwracają dziś tylko `kill()` — **brakuje `pause()` i `resume()`**.

## 2.2. Kinetic
Obecna sekcja `KINETIC` ma:
- własny główny `pinnedTl`,
- `trigger: container`,
- `start: "top top"`,
- `pin: true`,
- `scrub: true`,
- intro liczone przez `I = I_BASE * BRIDGE_MULTIPLIER`,
- snap-geometrię opartą o:
  - `TOTAL_U`,
  - `SNAP1_U`, `SNAP2_U`, `SNAP3_U`,
  - `BRIDGE_END_PROGRESS`,
  - `GRAB_START`, `HYS`,
- state machine z rozróżnieniem:
  - `bridge`,
  - `kinetic`.

To oznacza, że `KINETIC` już dziś **myśli w kategoriach fazy wejściowej / bridge’u**, nawet jeśli standalone działa jako osobna sekcja.

## 2.3. Tła
Tonalnie obie sekcje są kompatybilne:
- `FAKTY` siedzą na jasnym świecie,
- `KINETIC` również startuje z jasnego tła `#f7f6f4`.

To jest wielka zaleta: **na styku nie trzeba walczyć z brutalnym skokiem kolorystycznym**.

---

# 3. Finalna decyzja na ten etap

## Robimy:
### `BridgeFaktyKinetic`

## Nie robimy teraz:
- stawiania `FAKTY` i `KINETIC` osobno w `page.tsx`,
- fixed-underlay eksperymentów,
- spacerów i sztucznych overlapów poza wrapperem,
- ostatecznej decyzji o dolnym przejściu `KINETIC → Block 4`.

### Bardzo ważne
Ten dokument rozwiązuje **górny bridge**.

**Nie zamyka jeszcze** ostatecznej architektury dolnej krawędzi `KINETIC`, bo pod nią jest jeszcze trzecia sekcja i nie chcemy dziś zabetonować czegoś, co za chwilę może wymagać korekty.

---

# 4. Model architektoniczny do wdrożenia

## Jeden wrapper
Developer tworzy nowy komponent roboczy, np.:

- `BridgeFaktyKinetic.tsx`

## W środku wrappera są 2 warstwy

### Warstwa A — `FAKTY` (na wierzchu)
Rola:
- outgoing section,
- widoczna na starcie,
- jedzie do góry,
- po crossoverze przechodzi w hibernację.

### Warstwa B — `KINETIC` (pod spodem)
Rola:
- incoming section,
- na starcie ukryta narracyjnie przez kompozycję,
- rodzi się pod `FAKTY`,
- po crossoverze przejmuje scenę.

## Jeden wspólny progress scrolla
Wrapper ma jeden główny scroll progress / timeline, który:
- wypycha `FAKTY` w górę,
- równocześnie uruchamia intro `KINETIC`,
- domyka crossover,
- a potem oddaje ster właściwej fazie kinetic.

---

# 5. Najprostsza logika faz

## Faza A — Start
- `FAKTY` są główną treścią na ekranie,
- `KINETIC` już istnieje pod spodem,
- ale nie przejęła jeszcze narracji.

## Faza B — Overlap / Bridge
- `FAKTY` jadą w górę,
- `KINETIC` zaczyna własne intro,
- puste pole pod `FAKTY` ma zostać wypełnione pustą górną fazą `KINETIC`.

To jest najważniejszy moment całej operacji.

## Faza C — Kinetic takeover
- `FAKTY` opuszczają ekran,
- `KINETIC` przejmuje widok,
- ciężkie elementy `FAKTY` nie powinny dalej żreć CPU.

---

# 6. Zasada wydajnościowa

## Nie zabijać `FAKTY` natychmiast.
## Hibernować `FAKTY` po crossoverze.

To jest krytyczne.

### Dlaczego nie hard kill od razu?
Bo jeśli user cofnie scroll do góry, bridge musi umieć odtworzyć stan wstecz.

### Co robimy zamiast tego?
Po tym, jak `FAKTY` realnie wyjdą z kadru:
- zatrzymujemy ich ciężkie silniki,
- zostawiamy tani snapshot DOM / layout,
- przy powrocie do góry możemy wznowić to, co trzeba.

### Czyli potrzebny lifecycle dla `FAKTY`:
- `pause()`
- `resume()`
- `kill()`

Dziś standalone `FAKTY` mają tylko `kill()`.

---

# 7. Co dokładnie hibernować w `FAKTY`

Po crossoverze NIE powinny dalej pracować:

## 7.1. `organic-overlay`
- zatrzymać loop / rendering,
- zdjąć aktywność,
- wygasić opacity,
- zwolnić koszt blendu, jeśli możliwe.

## 7.2. `fakty-tunnel`
- zatrzymać pętlę / ticker,
- zostawić statyczny stan albo wygasić,
- nie renderować dalej poza aktywną fazą.

## 7.3. frame-scroll / playhead klatek
- nie aktualizować dalej `applyFrame(...)`,
- zatrzymać scrub playheada,
- zachować ostatni stan wizualny.

## 7.4. preload pozostałych frame’ów
- jeśli jeszcze trwa w tle, po crossoverze można go zatrzymać.

## 7.5. resize / listeners zależne od pełnej aktywności
- jeśli zostają, powinny robić no-op w stanie `paused`.

---

# 8. Czego NIE hibernować w `FAKTY`

Nie trzeba niszczyć od razu:
- samego DOM tekstu,
- geometrii bloku,
- lekkiego stanu wizualnego,
- struktury warstwy.

Powód:
- przy scrollu w górę chcesz szybki `resume()`,
- a nie pełne odbudowywanie sekcji od zera przy każdym cofnięciu.

---

# 9. Co trzeba zmienić / dopisać w praktyce

## 9.1. Wrapper bridge
Developer tworzy nowy wrapper, który:
- jest ownerem lifecycle,
- steruje obiema warstwami,
- pilnuje progresu overlapu.

## 9.2. `FAKTY`
Trzeba doposażyć sekcję / renderer w:
- `pause()`
- `resume()`
- możliwość startu bez autonomicznego `DOMContentLoaded`,
- podporządkowanie ownerowi wrappera.

## 9.3. `KINETIC`
Na ten moment:
- nie przebudowywać wnętrza,
- wykorzystać istniejący pacing intro,
- wykorzystać istniejący bridge math tam, gdzie to pomaga,
- nie zamykać jeszcze dolnego końca pod Block 4.

---

# 10. Co ZOSTAJE poza zakresem tego etapu

Na razie NIE podejmujemy jeszcze finalnej decyzji o:
- `KINETIC → Block 4`,
- dolnym handoffie,
- czy obecny model końcówki `KINETIC` zostaje 1:1,
- czy `Block 4` będzie ją przykrywać, przejmować, czy następować po niej bardziej klasycznie.

Powód:
Chcemy najpierw obejrzeć końcówkę i dopiero potem potwierdzić, że plan początku rzeczywiście nie wpada w pułapkę przy swoim finale.

To jest celowe i rozsądne.

---

# 11. Najprostszy plan implementacji dla developera

## Etap 1 — Scena
- stworzyć wrapper bridge,
- osadzić w nim warstwę `FAKTY` i warstwę `KINETIC`,
- ustawić poprawne warstwy / stacking / overflow.

## Etap 2 — Overlap
- uruchomić wspólny progress,
- doprowadzić do sytuacji, w której puste strefy obu sekcji pokrywają się bez pustego ekranu.

## Etap 3 — Crossover
- ustalić moment, w którym `FAKTY` wychodzą z kadru,
- po tym momencie przełączyć `FAKTY` w `pause()`.

## Etap 4 — Reverse scroll
- przewinąć w dół i w górę,
- sprawdzić, czy `resume()` odtwarza stan bez rozjazdu.

## Etap 5 — Dopiero potem tuning
- stroić timing overlapu,
- stroić długość bridge fazy,
- nie dotykać jeszcze dolnego handoffu.

---

# 12. Co developer ma traktować jako robocze stałe

Dla potrzeb pierwszej wersji bridge można przyjąć roboczo:
- wysokość / geometrię `FAKTY` na desktopie,
- wysokość / geometrię `FAKTY` na mobile,
- analogicznie ewentualnie tablet.

Nie trzeba na tym etapie wszystkiego liczyć jako superdynamicznej fizyki co klatkę.

To ma być:
- stabilne,
- powtarzalne,
- łatwe do strojenia.

---

# 13. Co trzeba sprawdzić po zrobieniu początku

Po wdrożeniu bridge’a `FAKTY → KINETIC` sprawdzamy:

1. Czy zniknął problem dwóch pustych ekranów.
2. Czy overlap wygląda naturalnie desktop/mobile.
3. Czy `FAKTY` po crossoverze przestają mielić ciężkie rzeczy.
4. Czy cofanie scrolla odtwarza scenę poprawnie.
5. Czy nic w początku nie psuje jeszcze końcówki `KINETIC` względem trzeciej sekcji.

---

# 14. Krótka wersja do zapamiętania

## Co robimy teraz
**Bridge wrapper dla `FAKTY → KINETIC`.**

## Co jest celem
**Zlikwidować dwa puste ekrany przez overlap obu sekcji.**

## Co jest najważniejszym warunkiem wydajności
**Po crossoverze `FAKTY` mają być hibernowane, nie trwale zabijane.**

## Czego jeszcze nie zamykamy
**Końcówki `KINETIC → Block 4`.**

---

# 15. Notatka strategiczna przed analizą końcówki

Ten dokument jest świadomie jednostronny:
- porządkuje górny bridge,
- ale nie rości sobie prawa do ostatecznej prawdy o całej sekcji `KINETIC`.

Następny etap powinien odpowiedzieć na pytanie:

> Czy przyjęty model początku jest zgodny z tym, jak `KINETIC` musi oddać ekran trzeciej sekcji na dole?

Dopiero po tej analizie będzie można uczciwie powiedzieć, czy plan początku jest nie tylko elegancki, ale też **strategicznie kompletny**.

---

# 16. Dopisek po analizie końcówki — `KINETIC → Block 4`

Po analizie końca `KINETIC` i początku `Block 4` przyjmujemy roboczo następujący model handoffu:

## 16.1. Stan końcowy `KINETIC`
`KINETIC` dochodzi do kontrolowanego stanu końcowego / freeze frame.
To jest stan, który ma zostać przez chwilę widoczny jako ostatnia klatka sekcji pod spodem.

## 16.2. Start `Block 4`
`Block 4` nie zaczyna od własnej pełnej, nieprzezroczystej planszy.
Startuje nad zamrożoną ostatnią klatką `KINETIC`.

W praktyce oznacza to:
- root `Block 4` ma pozostać transparentny na starcie,
- pierwsza uwaga użytkownika ma przejść na tekst `Block 4`,
- dopiero chwilę później reveal / fala ma zacząć domykać zasłonięcie tła `KINETIC`.

## 16.3. Kolejność zdarzeń na styku
Przyjmujemy kolejność:
1. `KINETIC` wchodzi w freeze frame,
2. pierwsze linie tekstu `Block 4` wchodzą od dołu,
3. chwilę później fala / reveal zaczyna zakrywać tło `KINETIC`.

Ta kolejność jest świadoma i pożądana.
Nie chcemy odwracać jej na „najpierw fala, potem tekst”, bo wtedy nowa sekcja za wcześnie gasi poprzednią scenę i traci się klarowność narracji.

## 16.4. Ważny warunek jakościowy
Opóźnienie między wejściem tekstu a startem reveal ma być krótkie.
To ma być:
- tekst przejmuje uwagę,
- zaraz potem fala domyka przejęcie.

Nie chcemy długiej martwej chwili, w której freeze frame `KINETIC` wisi bez sensu.

## 16.5. Zakres tej decyzji
Na tym etapie uznajemy tylko logikę handoffu wizualnego.
Nie zamykamy jeszcze pełnej architektury dolnej części `KINETIC` ani dalszej choreografii `Block 4/5`.

To oznacza:
- początek `Block 4` jest już kierunkowo ustalony,
- ale dalszy przebieg całej sekcji nadal może wymagać korekt po pełnym obejrzeniu końcówki.
