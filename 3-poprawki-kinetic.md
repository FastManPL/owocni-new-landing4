Montowanie robi problem
Ten slot był montowany za późno i asynchronicznie.
W praktyce wyglądało to tak:
najpierw był tylko placeholder DeferredMount, bez realnej treści w DOM,
potem po wejściu blisko viewportu aktywował się cały slot,
a dopiero wtedy zaczynały się pobierać i inicjalizować osobne chunki:
KineticEngine,
Blok45Section,
Blok45Engine.
To powodowało:
zmianę geometrii w trakcie scrolla,
późne tworzenie pinów i ST,
refreshy tuż po wejściu użytkownika w sekcję,
i w efekcie niestabilne wejście w Kinetic.

Co już wiemy
Wcześniejsze montowanie slotu Kinetic było wyraźnym plusem.
Problem wynikał z tego, że DeferredMount renderował najpierw tylko placeholder z minHeight, a właściwa treść wpadała dopiero blisko viewportu po activate().
Problem pogarszał się przez asynchroniczny, niesynchroniczny bootstrap.
Wspólny slot BridgeSection + SectionsClient jest dziś owinięty w jeden DeferredMount, ale po aktywacji:

KineticSection ładuje KineticEngine przez dynamic(..., { ssr:false }),
SectionsClient ładuje Blok45Section przez dynamic(..., { ssr:false }),
a Blok45Section dopiero potem ładuje Blok45Engine przez kolejny dynamic(..., { ssr:false }).
To znaczy: po późnej aktywacji slotu silniki startują równolegle i w niegwarantowanej kolejności, zależnej od czasu pobrania chunków i initu.

Na mobile duży zysk dało wyłączenie one-shot refreshu na wejściu do Kinetic.
W KineticEngine jest one-shot IntersectionObserver, który przy pierwszym wejściu sekcji w viewport robi scrollRuntime.requestRefresh('st-refresh'). Ten refresh wypadał zbyt blisko momentu wejścia użytkownika w sekcję i powodował skok. Wyłączenie tylko tego jednego refreshu dało jednoznacznie pozytywny efekt.

Co wdrożyć produkcyjnie

1. Nie deferred-mountować slotu Kinetic/Bridge tak późno
   Usunąć wspólny DeferredMount dla slotu BridgeSection + SectionsClient albo co najmniej renderować BridgeSection wcześniej/stale w DOM.
   Obecny kod ma wspólny DeferredMount dla obu komponentów.
2. Zostawić wyłączony one-shot refresh wejściowy w Kinetic
   Utrzymać wyłączenie tylko \_stIo -> requestRefresh('st-refresh') w KineticEngine.
   Zostawić aktywne:
   dynamic-mounted,
   dynamic-mounted-settle,
   layout-settle.
   To jest najbezpieczniejsza zmiana, która dała realną poprawę mobile bez wycinania całej logiki snapów.

Czego nie ruszać teraz
nie wycinać \_handleIntent ani snap logic Kinetica,
nie robić szerokiego refactoru scrollRuntime,
nie przepisywać całego Bridge/Blok45,
nie ruszać teraz warmup/moduleLoader jako „głównego fixa” — to temat wtórny.

Jednozdaniowy summary dla wdrożenia
Problem powodował późny, asynchroniczny mount slotu Kinetic/Blok45 oraz wejściowy \_stIo refresh w Kineticu; produkcyjnie należy wcześniej montować slot Bridge/Kinetic i zostawić wyłączony tylko one-shot section-in-view refresh w KineticEngine.

---

Ten prompt powinien to rozwiązać.

## Pracujesz tylko na runtime code. Twoim celem jest wdrożenie minimalnego, produkcyjnego fixa na podstawie już zakończonej diagnostyki. Nie rób refactoru. Nie poprawiaj nic „przy okazji”.

Cel wdrożenia
Wdrożyć tylko dwie zmiany, które już dały realny pozytywny efekt:
wcześniejsze montowanie slotu Kinetic
wyłączenie wejściowego one-shot refreshu \_stIo w KineticEngine

---

Co wdrażamy
Zmiana 1 — wcześniejszy mount slotu Kinetic
W src/app/page.tsx:
usuń wspólny DeferredMount wokół slotu:
BridgeSection
SectionsClient
albo wdroż dokładnie ten wariant, który dał najlepszy praktyczny rezultat w testach, jeśli jest już ustalony w kodzie roboczym

---

Zmiana 2 — zostaw wyłączony only-one-shot refresh na wejściu
W src/sections/kinetic/KineticEngine.tsx:
zachowaj wyłączenie tylko tego jednego refreshu:
one-shot IntersectionObserver / section-in-view
czyli \_stIo nie ma wołać scrollRuntime.requestRefresh('st-refresh')
ale observer nadal ma się jednorazowo odłączyć
zostaw bez zmian:
dynamic-mounted
dynamic-mounted-settle
layout-settle

---

Czego NIE ruszać
nie ruszaj \_handleIntent
nie ruszaj snap logic
nie ruszaj Blok45Engine.tsx
nie ruszaj BridgeSection.tsx
nie ruszaj scrollRuntime.ts
nie ruszaj CSS
nie dodawaj nowych flag eksperymentalnych
nie zostawiaj diagnostycznych przełączników, jeśli nie są potrzebne w produkcji
nie rób warmup/moduleLoader refactoru
nie zmieniaj nic poza tym, co konieczne do wdrożenia tych dwóch decyzji

---

Oczekiwany efekt
slot Kinetic nie może już montować się tak późno, żeby destabilizować wejście
Kinetic na mobile nie powinien mieć skoku tuż po wejściu z powodu \_stIo refresh
reszta snapów ma pozostać nienaruszona

---

Jeśli w kodzie są stare eksperymentalne flagi
usuń lub wyłącz stare flagi diagnostyczne, które nie są częścią finalnego wdrożenia
ale nie zmieniaj zachowania poza dwiema powyższymi decyzjami

---

Raport końcowy
Podaj tylko:
listę zmienionych plików
dokładnie co zostało wdrożone
które wcześniejsze eksperymenty zostały usunięte / wyłączone
potwierdzenie, że:
\_handleIntent nie został zmieniony
Blok45Engine.tsx nie został zmieniony
CSS nie został zmieniony
krótki opis, jak ten diff cofnąć, jeśli będzie potrzebny rollback
Nie rób nic więcej poza tym wdrożeniem.
Jeśli znajdziesz więcej niż 2 pliki do zmiany albo poczujesz potrzebę ruszenia Blok45 / Bridge / CSS, zatrzymaj się i zgłoś to zamiast improwizować.
