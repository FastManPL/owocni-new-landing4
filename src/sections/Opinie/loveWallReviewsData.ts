/**
 * Wspólne dane opinii — LoveWall (Faza 2.1 Prompt 3).
 * Silnik (`LoveWallSection`) + most SEO (`LoveWallSeoQuotes` RSC) importują ten sam zestaw.
 */
export type LoveWallReview = {
  text: string;
  author: string;
  fontClass: string;
  avatar: string;
};

export const LOVE_WALL_REVIEWS_ROW1: LoveWallReview[] = [
  { text: 'Wybitny profesjonalizm i dbałość o szczegóły i pełne zaangażowanie w uzyskanie efektu.', author: 'Paweł Śledziński', fontClass: 'card__quote--lexend-600 card__quote--size-90', avatar: 'https://i.pravatar.cc/88?img=11' },
  { text: 'Tutaj widać element twórczy. Kreacja stworzona przez Owocnych w końcu spełniła moje wymagania. Polecam.', author: 'Tytus Rogalewski', fontClass: 'card__quote--fraunces', avatar: 'https://i.pravatar.cc/88?img=12' },
  { text: 'Jako trener sprzedaży i biznesu, często muszę delegować zadania. Co można powiedzieć o owocnych? To najlepsze miejsce w które możesz trafić.', author: 'Patryk Jasiński', fontClass: 'card__quote--lexend-200 card__quote--mobile-md', avatar: 'https://i.pravatar.cc/88?img=13' },
  { text: 'Zespół potrafił wykonać projekt lepiej niż było to w moich wyobrażeniach. Dziękuję :) Polecam!!!', author: 'A. Osiej', fontClass: 'card__quote--lexend-400', avatar: 'https://i.pravatar.cc/88?img=14' },
  { text: 'Ci ludzie naprawdę znają się na swojej pracy! Jesteśmy zachwycone efektem końcowym projektu, jak i życzliwym podejściem całego zespołu.', author: 'Małgorzata Rokicka', fontClass: 'card__quote--lexend-200 card__quote--mobile-md', avatar: 'https://i.pravatar.cc/88?img=15' },
  { text: 'Ta firma dba o to, aby nie tylko poznać potrzeby klienta, ale również je zrozumieć. Zdecydowanie polecam.', author: 'Maciej Nowak', fontClass: 'card__quote--arial', avatar: 'https://i.pravatar.cc/88?img=16' },
  { text: 'Owocni to profesjonalna firma i jak każda popełnia błędy - ale ich wyróżnia to, że potrafią je poprawić. Dzięki i do zobaczenia!', author: 'Konrad Kardacz', fontClass: 'card__quote--lexend-600 card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=17' },
  { text: 'Warto zainwestować swoje pieniądze w tak rzetelnej firmie. Dziękuję za współpracę!', author: 'Maciej Śl', fontClass: 'card__quote--lexend-800', avatar: 'https://i.pravatar.cc/88?img=18' },
  { text: 'Pomimo że dzieli nas cała Polska, kontakt był bardzo dobry.', author: 'Mateusz Weredyński', fontClass: 'card__quote--lexend-800 card__quote--size-xl-90', avatar: 'https://i.pravatar.cc/88?img=19' },
  { text: 'Analiza potrzeb i dużo pomysłów – nie ma tu przypadkowych działań. Pozdrawiam szczególnie Panią Karolinę. Polecam! 😊', author: 'Ula Jóźwik', fontClass: 'card__quote--lexend-200 card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=20' },
];

export const LOVE_WALL_REVIEWS_ROW2: LoveWallReview[] = [
  { text: 'Serdecznie Wam wszystkim dziękuję za zaangażowanie i cierpliwość! Dobra robota - świetny projekt. Pełen profesjonalizm!', author: 'Arletta Szczurek', fontClass: 'card__quote--fraunces card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=21' },
  { text: 'Wszystko na świetnym poziomie: obsługa klienta, która urzeka profesjonalizmem, szybkość reakcji, wsłuchiwanie się w potrzeby.', author: 'Anna Kopanczyk', fontClass: 'card__quote--lexend-400 card__quote--mobile-md', avatar: 'https://i.pravatar.cc/88?img=22' },
  { text: 'Świetna firma, świetni ludzie. Współpraca przebiegała rewelacyjnie i szybko. Efekt końcowy świetny. Polecam!', author: 'Piotr Orzeł', fontClass: 'card__quote--lexend-600 card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=23' },
  { text: 'Chciałbym gorąco polecić cały zespół owocnych w szczególności Panią Adriannę i Marcjannę które od początku współpracy dbają o nasz projekt.', author: 'Maciej Szukała', fontClass: 'card__quote--lexend-200 card__quote--mobile-md', avatar: 'https://i.pravatar.cc/88?img=24' },
  { text: 'Współpraca bardzo OWOCNA :) dużo cierpliwości..., kreatywności i rzetelnego podejścia. Z wielką przyjemnością polecam współpracę!', author: 'Beata Glinka', fontClass: 'card__quote--georgia card__quote--mobile-md', avatar: 'https://i.pravatar.cc/88?img=25' },
  { text: 'Już od pierwszego kontaktu czułem, że to właśnie ta firma. Polecam wszystkim, którzy chcą dobrze zainwestować w marketing swojej firmy.', author: 'Wojciech Urbanowicz', fontClass: 'card__quote--courier card__quote--size-xs card__quote--mobile-lg', avatar: 'https://i.pravatar.cc/88?img=26' },
  { text: 'Współpraca w pełni mnie usatysfakcjonowała, szczególnie pomysłowość i dobry kontakt z klientem. Polecam!!!', author: 'Kinga Mizerska', fontClass: 'card__quote--arial card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=27' },
  { text: 'Stworzony projekt wyszedł super. Polecam na 100%.', author: 'Bartosz Siwek', fontClass: 'card__quote--lexend-800 card__quote--size-xl', avatar: 'https://i.pravatar.cc/88?img=28' },
  { text: 'Obsługa jest bardzo miła. Odpowiadają cierpliwie na każde pytanie. Jestem w 100% zadowolona ze strony', author: 'Jzdoo', fontClass: 'card__quote--courier card__quote--mobile-sm', avatar: 'https://i.pravatar.cc/88?img=29' },
  { text: 'Polecam Agencję Owocni z całego serca. Fenomenalna jakość usług w dobrej cenie.', author: 'Wojciech Musiał', fontClass: 'card__quote--lexend-800', avatar: 'https://i.pravatar.cc/88?img=30' },
];
