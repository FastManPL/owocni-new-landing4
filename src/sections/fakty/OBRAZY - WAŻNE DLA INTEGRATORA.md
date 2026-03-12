**Poniżej masz \*\*kompletną instrukcję dla integratora\*\* w formie, którą możesz mu wkleić 1:1.** Ułożyłam ją tak, żeby była zgodna z Waszym P4: integrator ma być \*\*operatorem manifestu\*\*, nie autorem sekcji, nie optymalizatorem i nie „ulepszaczem”. \`src/sections/\*\*\` jest immutable, resource hints mają wynikać wyłącznie z manifestu, a wszelkie decyzje o dynamic import, warmup i geometrii mają iść dokładnie wg \`SECTION\_MANIFEST\`. :contentReference\[oaicite:0\]{index=0} :contentReference\[oaicite:1\]{index=1} :contentReference\[oaicite:2\]{index=2}  
\---  
\#\# INSTRUKCJA DLA INTEGRATORA — SEKCJA Z SEKWENCJĄ KLATEK \`background-image\`  
\#\#\# Status tej decyzji  
To jest \*\*sekcyjna decyzja integracyjna\*\*, nie globalna zmiana projektu.   
Dla \*\*tej konkretnej sekcji\*\* nie używamy \`next/image\` ani \`\_next/image\`, bo klatki działają jako \`background-image\` / \`background-clip: text\`, a formaty są \*\*ręcznie przygotowane\*\* przez właściciela jako AVIF \+ WebP. Integrator \*\*nie zmienia tej architektury\*\* — wykonuje ją 1:1. Ogólna zasada projektu mówi, że integrator wykonuje manifest i nie optymalizuje sekcji samodzielnie. :contentReference\[oaicite:3\]{index=3} :contentReference\[oaicite:4\]{index=4} :contentReference\[oaicite:5\]{index=5}  
\---  
**\#\#\# 1\. Twoja rola przy tej sekcji**  
Jesteś \*\*operatorem manifestu\*\*, nie autorem sekcji.   
Nie zmieniasz logiki sekcji, nie podmieniasz sposobu ładowania obrazów, nie przepinasz tego na \`next/image\`, nie dodajesz własnej „optymalizacji”. Jeśli coś w sekcji wymaga zmiany wewnątrz \`src/sections/\*\*\`, zatrzymujesz się i odsyłasz temat do Fabryki. :contentReference\[oaicite:6\]{index=6} :contentReference\[oaicite:7\]{index=7} :contentReference\[oaicite:8\]{index=8}  
\---  
**\#\#\# 2\. Co jest immutable**  
Nie dotykasz:  
\- \`src/sections/\*\*\`  
\- \`src/lib/scrollRuntime.ts\`  
\- \`src/components/SmoothScrollProvider.tsx\`  
Każdy diff w \`src/sections/\*\*\` \= odrzucasz. Jeśli sekcja wymaga poprawki, to wraca do Fabryki. :contentReference\[oaicite:9\]{index=9} :contentReference\[oaicite:10\]{index=10}  
\---  
\#\#\# 3\. Model assetów dla tej sekcji  
Ta sekcja korzysta z \*\*ręcznie przygotowanych statycznych plików\*\* w \`public/frames/\`.  
Wymagany układ:  
\- \`/public/frames/fakty-01.avif\`  
\- \`/public/frames/fakty-01.webp\`  
\- …  
\- komplet par dla całej sekwencji  
Nie używasz dla tych klatek:  
\- \`next/image\`  
\- \`getImageProps()\`  
\- \`\_next/image?...\`  
\- żadnego dodatkowego serwowania formatów przez Next dla tej sekcji  
Sekcja ma używać bezpośrednio URL-i z \`public\`, a wybór formatu ma się odbywać po stronie przeglądarki przez CSS \`image-set(...)\`. Integrator tego \*\*nie zmienia\*\*. To wpisuje się też w regułę, że Asset Loading Map ma być wykonywana zgodnie z ustaleniem właściciela/manifestu, a nie wymyślana na nowo podczas integracji. :contentReference\[oaicite:11\]{index=11} :contentReference\[oaicite:12\]{index=12}  
\---  
\#\#\# 4\. Jak ma działać wybór formatu  
Dla tej sekcji obowiązuje:  
\- podstawowy mechanizm: \`image-set(...)\`  
\- fallback dla starszych przeglądarek: zwykły \`url(...webp)\`  
Czyli sekcja sama podaje do CSS wartość w stylu:  
\- AVIF \+ WebP przez \`image-set(...)\`  
\- WebP jako fallback  
Ty jako integrator \*\*nie dokładasz\*\* JS-detekcji AVIF, nie przerabiasz tego na \`next/image\`, nie wymuszasz własnych transformacji.  
\---  
\#\#\# 5\. Czego masz NIE robić  
Dla tej sekcji masz bezwzględny zakaz:  
\- przepinania klatek na \`next/image\`  
\- przepinania klatek na \`\_next/image\`  
\- dokładania \`images.formats\` jako „fixu tej sekcji”  
\- dokładania własnego preprocessingu obrazów  
\- zamiany \`background-image\` na \`\<img\>\`  
\- przerabiania \`image-set(...)\` na cokolwiek innego  
\- dodawania resource hints, preloadów lub prefetchów \*\*spoza manifestu\*\*  
\- grzebania w \`src/sections/\*\*\`, żeby „ulepszyć pipeline obrazków”  
To jest dokładnie zgodne z P4: integrator nie optymalizuje sekcji, nie dodaje hintów spoza manifestu i nie modyfikuje zawartości sekcji. :contentReference\[oaicite:13\]{index=13} :contentReference\[oaicite:14\]{index=14} :contentReference\[oaicite:15\]{index=15}  
\---  
\#\#\# 6\. Co masz zrobić w integracji  
Wykonujesz tylko to, co wynika z \`SECTION\_MANIFEST\`:  
1\. sprawdzasz kompletność manifestu,  
2\. integrujesz sekcję w \`page.tsx\` albo \`SectionsClient.tsx\` zgodnie z \`perf.loading.dynamicImport\`,  
3\. dodajesz resource hints wyłącznie z \`perf.resourceHints\`,  
4\. konfigurujesz warmup wyłącznie z \`perf.loading.warmup\`,  
5\. jeśli \`geometryMutable \=== true\` i \`geometryRefresh \!== 'self'\`, dodajesz \`useGeometryRefresh()\` w client boundary,  
6\. nie zmieniasz sekcji od środka. :contentReference\[oaicite:16\]{index=16} :contentReference\[oaicite:17\]{index=17} :contentReference\[oaicite:18\]{index=18} :contentReference\[oaicite:19\]{index=19}  
\---  
\#\#\# 7\. Jak traktować tę sekcję w manifeście  
Dla tej sekcji w manifeście ma być jasno zapisane, że:  
\- asset group \= sekwencja klatek w \`public/frames\`  
\- format strategy \= \`image-set(avif+webp)\` \+ fallback \`webp\`  
\- image delivery \= \*\*static public assets\*\*  
\- optimization owner \= \*\*sekcja / przygotowane assety\*\*, nie Next Image Optimization  
\- resource hints tylko jeśli właściciel je oznaczył jako HOT/WARM  
\- brak dodatkowej negocjacji formatu po stronie Next dla tej sekcji  
Integrator ma wykonać ten kontrakt 1:1. Jeśli manifest tego nie mówi, nie zgadujesz i wracasz do Fabryki. To jest dokładnie rola operatora manifestu. :contentReference\[oaicite:20\]{index=20} :contentReference\[oaicite:21\]{index=21}  
\---  
\#\#\# 8\. Resource hints dla tej sekcji  
Hinty dodajesz tylko, jeśli manifest je przewiduje.  
Mapowanie jest standardowe:  
\- \`preconnectDomains\[\]\` → \`preconnect(...)\`  
\- \`preloadCandidates\[\]\` → \`preload(...)\`  
\- \`prefetchDnsDomains\[\]\` → \`prefetchDNS(...)\`  
\- \`prefetchCandidates\[\]\` → \`\<link rel="prefetch"\>\` po hydracji  
Nie dodajesz nic poza manifestem. Jeśli sekwencja klatek jest oznaczona jako WARM, możesz dostać odpowiednie hinty / warmup w manifeście. Jeśli nie ma ich w manifeście — nic nie dodajesz. :contentReference\[oaicite:22\]{index=22} :contentReference\[oaicite:23\]{index=23}  
\---  
\#\#\# 9\. Dynamic import i warmup  
Nie myl dwóch rzeczy:  
\- \`next/dynamic\` \= moment mountu sekcji  
\- \`moduleLoader\` / warmup \= wcześniejsze pobranie zasobu lub modułu  
Masz wykonać oba mechanizmy dokładnie wg manifestu. Jeśli \`perf.loading.dynamicImport \=== true\`, sekcja trafia do \`SectionsClient.tsx\`; jeśli \`false\`, idzie bezpośrednio do \`page.tsx\`. Warmup konfigurujesz zgodnie z \`perf.loading.warmup\`. Nie wymyślasz własnej polityki. :contentReference\[oaicite:24\]{index=24} :contentReference\[oaicite:25\]{index=25} :contentReference\[oaicite:26\]{index=26}  
\---  
\#\#\# 10\. Weryfikacja asset pipeline dla tej sekcji  
Po integracji sprawdzasz ręcznie w DevTools → Network:  
\- czy requesty idą do \`/frames/...\`  
\- czy \*\*nie\*\* idą do \`/\_next/image?...\`  
\- czy \`Content-Type\` zgadza się z dostarczonym plikiem  
\- czy nie ma starych PNG/JPEG pod tym samym basename  
\- czy sekcja faktycznie używa przygotowanych assetów z \`public\`  
W Waszym Developer Guide jest już gate do diagnozy obrazków: sprawdzenie Request URL i Content-Type. Tu dla tej sekcji oczekiwanym wynikiem jest \*\*statyczny URL z \`public/frames\`\*\*, nie pipeline Next Image. :contentReference\[oaicite:27\]{index=27}  
\---  
\#\#\# 11\. Jeśli zobaczysz cokolwiek z tej listy — STOP  
Zatrzymujesz integrację i wracasz do Fabryki, jeśli:  
\- LLM proponuje zmianę w \`src/sections/\*\*\`  
\- sekcja wymaga zmiany sposobu budowania \`image-set(...)\`  
\- manifest jest niekompletny albo sprzeczny  
\- hinty nie są jawnie opisane w manifeście  
\- ktoś chce „naprawić” tę sekcję przez \`next/image\`  
\- asset pipeline nie zgadza się z kontraktem sekcji  
To jest dokładnie zgodne z zasadą eskalacji z Developer Guide: gdy problem dotyczy sekcji albo manifestu, nie improwizujesz. :contentReference\[oaicite:28\]{index=28} :contentReference\[oaicite:29\]{index=29}  
\---  
\#\# Krótka wersja do wklejenia integratorowi  
\`\`\`text  
Pracujemy w trybie integracji sekcji LP Owocni.  
Ta sekcja używa ręcznie przygotowanej sekwencji klatek jako background-image.  
Dla tej sekcji NIE używamy next/image ani Next Image Optimization.  
Zasady nienaruszalne:  
1\. src/sections/\*\* jest immutable. Nie proponuj zmian w tych plikach.  
2\. Sekcja ma korzystać wyłącznie z assetów statycznych z public/frames.  
3\. Format wybiera przeglądarka przez image-set(avif+webp) z fallbackiem do webp.  
4\. Zakaz użycia \_next/image, getImageProps, next/image i własnych „optymalizacji” dla tej sekcji.  
5\. Resource hints tylko z SECTION\_MANIFEST — nic ekstra.  
6\. Dynamic import, warmup, geometry refresh i mount sekcji wykonuj wyłącznie wg manifestu.  
7\. Jeśli manifest czegoś nie mówi albo coś wymaga zmiany wewnątrz sekcji → STOP i wróć do Fabryki.  
Checklist po integracji:  
\- requesty klatek idą do /frames/...  
\- brak requestów do /\_next/image dla tej sekcji  
\- brak zmian w src/sections/\*\*  
\- resource hints zgodne z manifestem  
\- page.tsx / SectionsClient.tsx zgodne z perf.loading.dynamicImport  
\- jeśli geometryMutable i geometryRefresh \!= self → useGeometryRefresh w client boundary  
\`\`\`  
Jeśli chcesz, mogę teraz zrobić drugą wersję: \*\*bardzo techniczną checklistę dla integratora krok po kroku w Cursorze\*\*, już w stylu sesji A/B/C.

