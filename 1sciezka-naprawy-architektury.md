Notatka wdrożeniowa

1. Główny problem
   Obecny model montowania sprzęga w jedno cztery różne rzeczy:
   pojawienie się sekcji w DOM,
   pojawienie się treści/semantyki sekcji,
   pobranie kodu,
   start ciężkiej inicjalizacji.
   To jest rdzeń problemu.
   W runtime krytyczny slot BridgeSection + SectionsClient był/pozostaje montowany jako całość, a wewnątrz ma jeszcze kolejne warstwy lazy/client-only: KineticSection -> dynamic(ssr:false) -> KineticEngine oraz SectionsClient -> Blok45Section -> dynamic(ssr:false) -> Blok45Engine. To oznacza, że po późnej aktywacji slotu fetch, init i tworzenie ST uruchamiają się asynchronicznie i w niegwarantowanej kolejności. Efekt: zmiana geometrii i refreshy w trakcie scrolla, niestabilne wejście w sekcję i „zawiechy/przeskoki”.
2. Co Konstytucja przewidywała poprawnie
   Konstytucja zakładała właściwy model:
   SSR markup + client engine sidecar zamiast pełnego client-only dla całej sekcji,
   rozdzielenie ról: moduleLoader = transfer, next/dynamic = mount,
   stabilną geometrię sekcji przez min-height / aspect-ratio / skeleton, żeby nie robić CLS,
   requestRefresh() po async boundaries, ale w kontrolowany sposób, a nie jako późny chaos po wejściu użytkownika.
   Czyli problem nie polega na tym, że Konstytucja była błędna. Problem polega na tym, że runtime od niej odjechał.
3. Jakie są skutki obecnych odstępstw
   UX
   Późny mount całych slotów powoduje, że sekcja „budzi się” wtedy, gdy użytkownik już w nią wjeżdża. To destabilizuje geometrię, ST i pin w momencie interakcji. Stąd skoki, doczytywanie w trakcie scrolla i wrażenie, że strona nie nadąża za użytkownikiem.
   SEO / indeksowalność / ocena strony przez systemy Google
   Google wprost ostrzega, że primary content nie powinien być lazy-loadowany w sposób zależny od interakcji użytkownika, bo Google nie wykonuje takich interakcji jak swipe, click czy typing; źle wdrożony lazy loading może ukryć treść przed Google. To oznacza, że jeśli duża część below-the-fold istnieje dopiero po scrollu/mount triggerowanym zachowaniem usera, to duża część strony może nie być widoczna dla crawlera. (developers.google.com)
   W praktyce: obecne podejście ryzykuje, że Google widzi głównie górny fragment strony, a nie pełną treść sprzedażową/sekcyjną. To szkodzi indeksowalności i jakości oceny landing page.
4. Co już zostało potwierdzone testami
   Dwie zmiany dały realny plus i są obecnie najsilniejszymi, potwierdzonymi sygnałami:
   wcześniejsze montowanie slotu Kinetic
   Późny mount tego slotu był szkodliwy.
   wyłączenie one-shot refreshu wejściowego \_stIo w KineticEngine
   Ten refresh wypadał za blisko momentu wejścia użytkownika w sekcję i destabilizował mobile entry. Reszta refreshy Kinetica (dynamic-mounted, dynamic-mounted-settle, layout-settle) może zostać.
   Te dwie rzeczy są dziś najcenniejszym wynikiem diagnostyki.
5. Co wdrożyć produkcyjnie
   A. Rozdzielić shell / transfer / init
   Docelowy model ma być taki:
   shell sekcji wcześniej
   Sekcja istnieje semantycznie i geometrycznie od razu.
   kod sekcji wcześniej, w tle
   Warmup/prefetch w idle lub po Hero.
   ciężki engine później
   Inicjalizacja dopiero, gdy ma sens.
   To jest dokładnie model wspierany przez App Router i Server/Client Components w Next.js. Server Components mają dostarczać markup, a lazy loading ma odraczać tylko Client Components i biblioteki, żeby zmniejszyć initial JS i lepiej sterować momentem mountu. (nextjs.org, nextjs.org)
   B. Nie lazy-loadować całych sekcji, jeśli ich geometria i treść są ważne
   Nie montować późno całego shellu sekcji.
   Lazy-loadować:
   engine,
   ciężką bibliotekę,
   interaktywność.
   Nie lazy-loadować:
   samej semantyki sekcji,
   samej geometrii sekcji,
   treści, która ma być widoczna dla crawl/SEO/quality evaluation.
   C. Wykorzystać realnie moduleLoader
   moduleLoader.ts już istnieje i jest zaprojektowany pod warmup idle / near-viewport, ale dziś system nie jest nim konsekwentnie sterowany. To trzeba doprowadzić do stanu, w którym warmup jest uruchamiany z jednego client boundary i konsumowany przez sekcje zgodnie z polityką, a nie tylko punktowo.
6. Na co trzeba uważać, żeby nie zabić LCP i CLS
   LCP
   Nie wolno zamienić „późnego mountu” na „wczesny ciężki init wszystkiego”.
   Wcześniejsze SSR shelli zwykle nie szkodzi LCP, ale wcześniejsze pobieranie i inicjalizowanie ciężkiego JS może już konkurować z Hero i LCP o sieć oraz main thread. LCP pogarsza głównie to, co blokuje render największego elementu w viewportcie. (web.dev)
   Zasada: przyspieszyć gotowość sekcji, nie przyspieszać bezwarunkowo ich ciężkiej pracy.
   CLS
   Jeśli sekcja ma się pojawiać wcześniej jako shell, jej geometria musi być możliwie 1:1 z finalną sekcją:
   min-height,
   aspect-ratio,
   explicit dimensions,
   skeleton zgodny z realnym box model.
   Najczęstsze źródła złego CLS to właśnie dynamicznie wstrzykiwana treść bez zarezerwowanego miejsca i media bez wymiarów. (web.dev)
   Zasada: wcześniej shell, ale z poprawną geometrią.
7. Co ma zostać pod szczególną kontrolą
   Nie ruszać teraz logiki snapów Kinetica
   \_handleIntent ma zostać bez zmian. Próby amputowania entry snapu rozwalały dalsze snapy.
   Nie ruszać teraz szeroko Blok45/Bridge
   Te sekcje są czułe na drobne zmiany w kolejności mountu, pinie i overlapie.
   Nie zostawiać runtime jako wielowarstwowego client-only bootstrapu
   Obecny układ:
   BridgeSection client,
   KineticSection dynamic ssr:false,
   SectionsClient dynamic ssr:false,
   Blok45Section dynamic ssr:false
   jest zbyt kruchy na wejściu.
   Jedyne akceptowalne ryzyko wizualne na tym etapie dotyczy Kinetic/Blok45
   Reszta sekcji przy przepinaniu na model shell + późniejszy engine nie powinna mieć regresji wizualnej.
8. Minimalny kierunek wdrożenia
   Teraz
   utrzymać wcześniejsze montowanie slotu Kinetic,
   utrzymać wyłączony wejściowy \_stIo refresh w KineticEngine,
   nie ruszać \_handleIntent,
   nie ruszać szeroko Bridge/Blok45,
   zacząć plan migracji z „full section deferred mount” na „SSR shell + warmup + późniejszy engine”.
   Następnie
   Sekcje podzielić na trzy grupy:
   lekkie/contentowe → najszybciej przepiąć na shell + minimalny client JS,
   średnie → shell + lazy engine,
   ciężkie/makro (Kinetic/Blok45) → osobny, ostrożny plan.
9. Krótkie podsumowanie dla wdrożenia
   Obecny problem wynika z tego, że DeferredMount przejął jednocześnie odpowiedzialność za DOM, treść, fetch i init. To łamie model z Konstytucji i powoduje późny, asynchroniczny bootstrap sekcji w trakcie scrolla. Produkcyjnie trzeba wrócić do modelu: shell sekcji wcześniej, kod wcześniej przez warmup, ciężki engine później. Potwierdzone już teraz: wcześniejszy mount slotu Kinetic pomaga, a wejściowy one-shot refresh \_stIo w KineticEngine szkodzi i powinien pozostać wyłączony. To jest ważne nie tylko dla UX i Core Web Vitals, ale też dla indeksowalności, bo Google nie powinien być zmuszany do „doscrollowania” do primary content.
