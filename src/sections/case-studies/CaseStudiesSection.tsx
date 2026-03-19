'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAutoplayVideo } from '@/hooks/use-autoplay-video';
import { getAssetPath } from '@/lib/assetPath';
import './case-studies-section.css';

/** Kafelek 1 (KSIĘGOWOŚĆ) — mobile. Wysokość = proporcje (kwadrat). */
const MOBILE_PARAMS_DEFAULT = {
  bgVisible: 1,
  bgPosX: 0,
  bgPosY: 50,
  consultingLeft: 6,
  consultingWidth: 60,
  finanseLeft: 32,
  finanseWidth: 62,
};

/** Kafelek 2 (USŁUGI IT & AI) — mobile. */
const MOBILE_PARAMS_TILE2_DEFAULT = {
  imgItLeft: 6,
  imgItWidth: 89,
  imgItBottom: 10,
  pragmaLeft: -8,
  pragmaWidth: 48,
  dlonLeft: 20,
  dlonWidth: 88,
  showKratki1: 1,
  kratki1Left: 21,
  kratki1Bottom: 14,
  kratki1Width: 15,
  showKratki2: 0,
  kratki2Left: 25,
  kratki2Bottom: 35,
  kratki2Width: 22,
  showTekst1: 1,
  tekst1Left: 25,
  tekst1Bottom: 18,
  tekst1Width: 51,
  showTekst2: 1,
  tekst2Left: 33,
  tekst2Bottom: -4,
  tekst2Width: 29,
  showKwadratTyl: 1,
  showKwadratSrodek: 1,
  showKwadratPrzod: 1,
  kwadratTylLeft: -3,
  kwadratTylBottom: 42,
  kwadratSrodekLeft: -2,
  kwadratSrodekBottom: 38,
  kwadratPrzodLeft: -1,
  kwadratPrzodBottom: 34,
};

/** Kafelek 3 (MEDIA) — mobile. */
const MOBILE_PARAMS_TILE3_DEFAULT = {
  eyeLeft: 5,
  eyeWidth: 90,
  eyeTop: 34,
  tlumLeft: 4,
  tlumWidth: 90,
  tlumTop: 55,
  hipnoLeft: 6,
  hipnoWidth: 95,
  hipnoTop: 62,
  showTlo: 1,
  tloLeft: 70,
  tloTop: 28,
  tloWidth: 40,
  showHand1: 1,
  hand1Left: 73,
  hand1Top: 40,
  hand1Width: 25,
  showHand2: 1,
  hand2Left: 79,
  hand2Top: 65,
  hand2Width: 25,
  showPrzyklady: 1,
  przykladyLeft: 15,
  przykladyTop: 41,
  przykladyWidth: 65,
};

export function CaseStudiesSection() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [mobileParams] = useState(MOBILE_PARAMS_DEFAULT);
  const [mobileParams2] = useState(MOBILE_PARAMS_TILE2_DEFAULT);
  const [mobileParams3] = useState(MOBILE_PARAMS_TILE3_DEFAULT);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const video1Ref = useAutoplayVideo();
  const video2Ref = useAutoplayVideo();
  const video3Ref = useAutoplayVideo();
  const video4Ref = useAutoplayVideo();

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      const root = rootRef.current;
      if (!root) return;

      const triggers: ScrollTrigger[] = [];
      let stCreated = false;
      let lazyStTimeout: ReturnType<typeof setTimeout> | null = null;
      let lazyStObserver: IntersectionObserver | null = null;

      function maybeCreateScrollTriggers() {
        if (stCreated) return;
        const currentRoot = rootRef.current;
        if (!currentRoot) return;
        stCreated = true;
        if (lazyStTimeout !== null) {
          clearTimeout(lazyStTimeout);
          lazyStTimeout = null;
        }
        lazyStObserver?.disconnect();
        lazyStObserver = null;

        const section1 = currentRoot.querySelector<HTMLElement>('[data-case-tile="1"]');
        const section2 = currentRoot.querySelector<HTMLElement>('[data-case-tile="2"]');
        const section3 = currentRoot.querySelector<HTMLElement>('[data-case-tile="3"]');

        if (section1) {
          section1.querySelectorAll('.parallax-slow').forEach((el: Element) => {
            const st = gsap.fromTo(
              el,
              { y: 0 },
              {
                y: -80,
                ease: 'none',
                scrollTrigger: {
                  trigger: section1,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (st.scrollTrigger) triggers.push(st.scrollTrigger);
          });
          section1.querySelectorAll('.parallax-fast').forEach((el: Element) => {
            const st = gsap.fromTo(
              el,
              { y: 0 },
              {
                y: -120,
                ease: 'none',
                scrollTrigger: {
                  trigger: section1,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (st.scrollTrigger) triggers.push(st.scrollTrigger);
          });
        }

        if (section2) {
          section2.querySelectorAll('.parallax-slow').forEach((el: Element) => {
            const st = gsap.fromTo(
              el,
              { y: 0 },
              {
                y: -240,
                ease: 'none',
                scrollTrigger: {
                  trigger: section2,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (st.scrollTrigger) triggers.push(st.scrollTrigger);
          });
          section2.querySelectorAll('.parallax-fast').forEach((el: Element) => {
            const st = gsap.fromTo(
              el,
              { y: 0 },
              {
                y: -150,
                ease: 'none',
                scrollTrigger: {
                  trigger: section2,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (st.scrollTrigger) triggers.push(st.scrollTrigger);
          });
          const kwadratTyl = section2.querySelector('.kwadrat-tyl');
          if (kwadratTyl) {
            const t = gsap.fromTo(
              kwadratTyl,
              { y: 0 },
              {
                y: -83,
                ease: 'none',
                scrollTrigger: {
                  trigger: section2,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const kwadratSrodek = section2.querySelector('.kwadrat-srodek');
          if (kwadratSrodek) {
            const t = gsap.fromTo(
              kwadratSrodek,
              { y: 0 },
              {
                y: 17,
                ease: 'none',
                scrollTrigger: {
                  trigger: section2,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const kwadratPrzod = section2.querySelector('.kwadrat-przod');
          if (kwadratPrzod) {
            const t = gsap.fromTo(
              kwadratPrzod,
              { y: 0 },
              {
                y: 141,
                ease: 'none',
                scrollTrigger: {
                  trigger: section2,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
        }

        if (section3) {
          const handFirst = section3.querySelector('.hand-1');
          if (handFirst) {
            const t = gsap.fromTo(
              handFirst,
              { x: 0, y: 0 },
              {
                x: -9.1,
                y: -10.3,
                ease: 'none',
                scrollTrigger: {
                  trigger: section3,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const handSecond = section3.querySelector('.hand-2');
          if (handSecond) {
            const t = gsap.fromTo(
              handSecond,
              { x: 0, y: 0 },
              {
                x: -2.275,
                y: -2.578,
                ease: 'none',
                scrollTrigger: {
                  trigger: section3,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const tloStrony = section3.querySelector('.tlo-strony');
          if (tloStrony) {
            const t = gsap.fromTo(
              tloStrony,
              { y: 0 },
              {
                y: -240,
                ease: 'none',
                scrollTrigger: {
                  trigger: section3,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const eyeImage = section3.querySelector('.eye-image');
          if (eyeImage) {
            const t = gsap.fromTo(
              eyeImage,
              { y: 0 },
              {
                y: -160,
                ease: 'none',
                scrollTrigger: {
                  trigger: section3,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
          const przykladyStrony = section3.querySelector('.przyklady-strony');
          if (przykladyStrony) {
            const t = gsap.fromTo(
              przykladyStrony,
              { y: 0 },
              {
                y: 200,
                ease: 'none',
                scrollTrigger: {
                  trigger: section3,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 1,
                },
              }
            );
            if (t.scrollTrigger) triggers.push(t.scrollTrigger);
          }
        }

        // Canvas image sequence (tile 2)
        const canvas = canvasRef.current;
        if (canvas && section2) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const frameCount = 41;
            const images: HTMLImageElement[] = [];
            for (let i = 0; i < frameCount; i++) {
              const img = document.createElement('img');
              img.src = getAssetPath(
                `/assets/portfolios/canvas/${String(i).padStart(3, '0')}.jpg`
              );
              images.push(img);
            }
            const updateCanvas = (index: number) => {
              if (images[index]?.complete) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
              }
            };
            images[0]?.addEventListener('load', () => updateCanvas(0));
            const st = gsap.to(
              {},
              {
                scrollTrigger: {
                  trigger: section2,
                  start: 'top 80%',
                  end: 'bottom 20%',
                  scrub: true,
                  onUpdate: (self) => {
                    const progress = self.progress;
                    const frameIndex = Math.min(
                      frameCount - 1,
                      Math.floor(progress * frameCount)
                    );
                    updateCanvas(frameIndex);
                  },
                },
              }
            );
            if (st.scrollTrigger) triggers.push(st.scrollTrigger);
          }
        }
      }

      lazyStObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) maybeCreateScrollTriggers();
        },
        { root: null, rootMargin: '0px', threshold: 0 }
      );
      lazyStObserver.observe(root);
      lazyStTimeout = setTimeout(maybeCreateScrollTriggers, 1200);

      return () => {
        if (lazyStTimeout !== null) clearTimeout(lazyStTimeout);
        lazyStObserver?.disconnect();
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: rootRef }
  );

  const StarIcon = () => (
    <svg
      className="w-[1rem] h-[1rem]"
      width="70"
      height="67"
      viewBox="0 0 70 67"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M68.6994 27.8C69.3994 27.1 69.5995 26.1 69.2995 25.3C68.8995 24.4 68.1995 23.8 67.3995 23.8L47.2995 20.8C46.6995 20.7 46.1995 20.3 45.8995 19.7L36.8995 1.3V1.2C36.3995 0.5 35.5995 0 34.7995 0C33.7995 0 32.9995 0.5 32.5995 1.4L23.5995 19.8C23.3995 20.3 22.7995 20.7 22.1995 20.8L2.19945 23.8C1.29945 23.9 0.599453 24.5 0.199453 25.4C-0.100547 26.3 0.0994532 27.2 0.799453 28L15.2995 42.3C15.7995 42.8 15.9995 43.4 15.8995 44.1L12.3995 64C12.1995 64.9 12.5995 65.8 13.2995 66.4L13.3995 66.5C13.8995 66.8 14.2995 66.9 14.6995 66.9C15.1995 66.9 15.5995 66.7 15.7995 66.6L33.7995 57C34.2995 56.7 34.9995 56.7 35.5995 57L53.4995 66.5C53.9995 66.8 54.8995 67.1 55.9995 66.4C56.8995 65.9 57.2995 64.9 57.0995 64L53.6995 43.8C53.5995 43.2 53.7995 42.5 54.1995 42.1L68.6994 27.8Z"
        fill="#FFC602"
      />
    </svg>
  );

  return (
    <section
      id="case-studies-section"
      ref={rootRef}
      className="flex flex-col"
    >
      {/* KSIĘGOWOŚĆ */}
      <div
        data-case-tile="1"
        className="flex justify-center gap-4 sm:gap-8 lg:gap-[10rem] h-auto lg:h-[45rem] -mt-[0.125rem] py-8 lg:py-0 px-4"
      >
        <div className="flex border-4 sm:border-8 lg:border-[2.1875rem] w-full max-w-[90rem] lg:w-[80rem] rounded-2xl lg:rounded-[2rem] bg-[#fff] h-auto lg:h-[40rem] border-[#FFFFFF] relative">
          <div
            className="flex flex-col lg:flex-row w-[100%] rounded-xl lg:rounded-[1.5rem]"
            style={{ backgroundColor: 'rgb(243, 238, 234)' }}
          >
            <div className="relative z-10 w-full lg:w-[75%] px-6 sm:px-8 lg:pl-[3rem] py-8 lg:mt-[2rem] lg:py-0 flex flex-col justify-center order-1 lg:order-1">
              <div className="mb-[1rem] text-mini">KSIĘGOWOŚĆ</div>
              <div className="font-roboto text-[clamp(24px,4vw,30px)] lg:text-[1.9rem] leading-[1.2] font-medium">
                Rebranding, który buduje <br />
                zaufanie zarządów i ustawia <br />
                proces sprzedaży
              </div>
              <div className="flex items-center gap-[0.3rem] mb-[1.5rem] mt-[2rem] lg:mt-[3.5rem]">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <div className="text-[#4A495E] font-normal font-roboto text-[clamp(16px,2.5vw,20px)] lg:text-[1.3rem] pr-0 lg:pr-[1.5rem] leading-[1.2]">
                Owocni zmienili naszą firmę z &apos;nudnej księgowości&apos; w
                zaufanego partnera CFO. Praca jak w zegarku. Polecam z czystym
                sumieniem.
              </div>
              <div className="flex items-center gap-4 mt-[2rem] lg:mt-[4rem]">
                <div className="w-[2.3rem] h-[2.3rem]">
                  <Image
                    src={getAssetPath('/assets/ptr.png')}
                    alt="Piotr Banach"
                    width={37}
                    height={37}
                    className="w-full h-full object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="text-mini">Piotr Banach</div>
                  <div className="text-[#90909D] text-mini">
                    DYREKTOR OPERACYJNY
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                clipPath:
                  'polygon(0px -10%, 110% -10%, 110% 100%, 0% 100%)',
              }}
              className="rounded-b-2xl lg:rounded-bl-[2rem] lg:rounded-tl-[8rem] relative w-full lg:w-[100%] bg-[#E4E2E3] aspect-square min-h-0 lg:aspect-auto lg:h-auto order-2 lg:order-2"
            >
              {isMobile && mobileParams.bgVisible ? (
                <div className="absolute inset-0 w-full h-full z-0 overflow-hidden rounded-t-[2rem] parallax-slow lg:hidden">
                  <Image
                    src={getAssetPath(
                      '/assets/banach-1wszyi-planFIN-1.png'
                    )}
                    alt=""
                    width={1400}
                    height={803}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${mobileParams.bgPosX}% ${mobileParams.bgPosY}%`,
                    }}
                    unoptimized
                    loading="lazy"
                  />
                </div>
              ) : null}
              <div
                className="left-[3rem] rounded-t-[2rem] overflow-hidden bottom-[-5rem] lg:bottom-[-5rem] absolute w-[calc(100%-6rem)] lg:w-[70rem] parallax-slow hidden lg:block"
                style={{
                  clipPath:
                    'polygon(0px 0px, 55.5% 0px, 55.5% 100%, 0% 100%)',
                }}
              >
                <Image
                  src={getAssetPath('/assets/banach-1wszyi-planFIN-1.png')}
                  alt=""
                  width={1400}
                  height={803}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <div
                className="rounded-t-[2rem] overflow-hidden left-[2rem] sm:left-[4rem] lg:left-[6rem] bottom-[0] lg:bottom-[0] absolute w-[60%] sm:w-[50%] lg:w-[25rem] parallax-fast"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams.consultingLeft}%`,
                        width: `${mobileParams.consultingWidth}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath(
                    '/assets/tworzenie-strony-konsulting.jpg'
                  )}
                  alt=""
                  width={350}
                  height={410}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
                <video
                  ref={video1Ref}
                  src={getAssetPath(
                    '/assets/portfolios/strona-pattern1.mp4'
                  )}
                  autoPlay
                  loop
                  playsInline
                  muted
                  className="left-[0.5rem] lg:left-[0.85rem] top-[12rem] sm:top-[15rem] lg:top-[18rem] absolute hidden sm:block"
                  style={{
                    clipPath:
                      'polygon(0px 0px, 90% 0px, 100% 90%, 0px 90%)',
                  }}
                />
                <video
                  ref={video2Ref}
                  src={getAssetPath(
                    '/assets/portfolios/strona-pattern2.mp4'
                  )}
                  autoPlay
                  playsInline
                  loop
                  muted
                  className="left-[0.5rem] lg:left-[0.85rem] top-[15rem] sm:top-[18rem] lg:top-[21.5rem] absolute hidden sm:block"
                  style={{
                    clipPath:
                      'polygon(0px 0px, 99% 0px, 100% 99%, 0px 99%)',
                  }}
                />
                <video
                  ref={video3Ref}
                  src={getAssetPath(
                    '/assets/portfolios/strona-pattern3.mp4'
                  )}
                  autoPlay
                  playsInline
                  loop
                  muted
                  className="left-[0.7rem] lg:left-[1.25rem] top-[18rem] sm:top-[21rem] lg:top-[25.5rem] absolute hidden sm:block"
                  style={{
                    clipPath:
                      'polygon(0px 0px, 99% 0px, 99% 100%, 0% 100%)',
                  }}
                />
              </div>
              <div
                className="rounded-t-[1.5rem] overflow-hidden bottom-[0rem] left-[45%] sm:left-[50%] lg:left-[13rem] absolute w-[40%] sm:w-[35%] lg:w-[25rem] parallax-slow"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams.finanseLeft}%`,
                        width: `${mobileParams.finanseWidth}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath(
                    '/assets/tworzenie-strony-finanse.jpg'
                  )}
                  alt=""
                  width={350}
                  height={295}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <video
                ref={video4Ref}
                playsInline
                muted
                autoPlay
                loop
                src={getAssetPath('/assets/portfolios/mobile-design.mp4')}
                className="right-[2rem] sm:right-[4rem] lg:left-[33rem] bottom-[-1rem] lg:bottom-[-1rem] absolute w-[25%] sm:w-[20%] lg:w-[12rem] parallax-fast hidden sm:block"
                style={{
                  maskImage: `url("${getAssetPath('/assets/portfolios/phoneMaskdesign.svg')}")`,
                  maskSize: '100% 100%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* USŁUGI IT & AI */}
      <div
        data-case-tile="2"
        className="flex justify-center gap-4 sm:gap-8 lg:gap-[10rem] h-auto lg:h-[45rem] -mt-[0.125rem] py-8 lg:py-0 px-4"
      >
        <div className="flex border-4 sm:border-8 lg:border-[2.1875rem] w-full max-w-[90rem] lg:w-[80rem] rounded-2xl lg:rounded-[2rem] bg-[#fff] h-auto lg:h-[40rem] border-[#FFFFFF] relative">
          <div
            className="flex flex-col lg:flex-row w-[100%] rounded-xl lg:rounded-[1.5rem]"
            style={{ backgroundColor: 'rgb(233, 236, 232)' }}
          >
            <div className="relative z-10 w-full lg:w-[75%] px-6 sm:px-8 lg:pl-[3rem] py-8 lg:mt-[2rem] lg:py-0 flex flex-col justify-center order-1 lg:order-1">
              <div className="mb-[1rem] text-mini">USŁUGI IT & AI</div>
              <div className="font-roboto text-[clamp(24px,4vw,30px)] lg:text-[1.9rem] leading-[1.2] font-medium">
                Nowy software house <br />
                od Pragmile™ wchodzi do <br />
                ligi enterprise AI w 3 miesiące
              </div>
              <div className="flex items-center gap-[0.3rem] mb-[1.5rem] mt-[2rem] lg:mt-[3.5rem]">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <div className="text-[#4A495E] font-normal font-roboto text-[clamp(16px,2.5vw,20px)] lg:text-[1.3rem] pr-0 lg:pr-[1.5rem] leading-[1.2]">
                Strona przyciąga dokładnie tych klientów, których szukamy. Tempo
                ekspresowe, terminy co do dnia! Będziemy wracać.
              </div>
              <div className="flex items-center gap-4 mt-[2rem] lg:mt-[4rem]">
                <div className="w-[2.3rem] h-[2.3rem]">
                  <Image
                    src={getAssetPath('/assets/mar.png')}
                    alt="Marcin Jabłonowski"
                    width={37}
                    height={37}
                    className="w-full h-full object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="text-mini">Marcin Jabłonowski</div>
                  <div className="text-[#90909D] text-mini">
                    DYREKTOR ZARZĄDZAJĄCY
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                clipPath:
                  'polygon(-10% -10%, 110% -10%, 110% 100%, -10% 100%)',
                background:
                  'linear-gradient(0deg, rgb(0, 0, 0) 88%, rgb(8, 29, 23) 100%)',
              }}
              className="relative rounded-b-2xl lg:rounded-bl-[2rem] lg:rounded-tl-[8rem] w-full lg:w-[100%] aspect-square min-h-0 lg:aspect-auto lg:h-[100%] order-2 lg:order-2 overflow-visible"
            >
              <div className="left-[2rem] sm:left-[4rem] lg:left-[5rem] bottom-[-1rem] absolute w-[calc(100%-4rem)] sm:w-[calc(100%-8rem)] lg:w-[30rem] h-[12rem] sm:h-[16rem] lg:h-[20rem] z-10 bg-[#121011]" />

              <div
                className="rounded-t-[2rem] overflow-hidden w-[70%] sm:w-[60%] lg:w-[30rem] left-[2rem] sm:left-[4rem] lg:left-[5rem] bottom-[2rem] sm:bottom-[3rem] lg:bottom-[3.5rem] absolute border-[0.0625rem] border-[#022300] z-10 parallax-slow"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams2.imgItLeft}%`,
                        width: `${mobileParams2.imgItWidth}%`,
                        bottom: `${mobileParams2.imgItBottom}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath(
                    '/assets/projektowanie-stron-it.jpg'
                  )}
                  alt=""
                  width={480}
                  height={250}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className={`left-[35%] sm:left-[40%] lg:left-[13.5rem] bottom-[0rem] absolute z-10 parallax-slow ${isMobile ? (mobileParams2.showKratki1 ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showKratki1
                    ? {
                        left: `${mobileParams2.kratki1Left}%`,
                        bottom: `${mobileParams2.kratki1Bottom}%`,
                        width: `${mobileParams2.kratki1Width}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/kratki.png')}
                  alt=""
                  width={200}
                  height={200}
                  className="w-[100px] sm:w-[150px] lg:w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <div
                className={`left-[25%] sm:left-[30%] lg:left-[10rem] bottom-[6rem] sm:bottom-[8rem] lg:bottom-[10rem] absolute z-10 parallax-fast ${isMobile ? (mobileParams2.showKratki2 ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showKratki2
                    ? {
                        left: `${mobileParams2.kratki2Left}%`,
                        bottom: `${mobileParams2.kratki2Bottom}%`,
                        width: `${mobileParams2.kratki2Width}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/kratki.png')}
                  alt=""
                  width={200}
                  height={200}
                  className="w-[100px] sm:w-[150px] lg:w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className="left-[-1rem] sm:left-[-1.5rem] lg:left-[-2rem] w-[35%] sm:w-[30%] lg:w-[18rem] bottom-[-1rem] absolute z-10 parallax-fast"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams2.pragmaLeft}%`,
                        width: `${mobileParams2.pragmaWidth}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/pragma-marcin.png')}
                  alt=""
                  width={288}
                  height={339}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className={`left-[25%] sm:left-[30%] lg:left-[10rem] w-[45%] sm:w-[40%] lg:w-[20rem] bottom-[3rem] sm:bottom-[5rem] lg:bottom-[6rem] absolute z-10 parallax-slow ${isMobile ? (mobileParams2.showTekst1 ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showTekst1
                    ? {
                        left: `${mobileParams2.tekst1Left}%`,
                        bottom: `${mobileParams2.tekst1Bottom}%`,
                        width: `${mobileParams2.tekst1Width}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/tekst-strony1.png')}
                  alt=""
                  width={320}
                  height={144}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <div
                className={`left-[40%] sm:left-[45%] lg:left-[15rem] bottom-[-1rem] absolute w-[25%] sm:w-[20%] lg:w-[10rem] z-10 parallax-slow ${isMobile ? (mobileParams2.showTekst2 ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showTekst2
                    ? {
                        left: `${mobileParams2.tekst2Left}%`,
                        bottom: `${mobileParams2.tekst2Bottom}%`,
                        width: `${mobileParams2.tekst2Width}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/tekst-strony2.png')}
                  alt=""
                  width={145}
                  height={120}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className="left-[2rem] sm:left-[4rem] lg:left-[5rem] w-[calc(100%-4rem)] sm:w-[70%] lg:w-[40rem] bottom-[-3rem] sm:bottom-[-4rem] lg:bottom-[-5rem] absolute z-10 parallax-fast"
                style={{
                  clipPath:
                    'polygon(0px 0px, 100% 0px, 100% 85%, 0px 85%)',
                  ...(isMobile
                    ? {
                        left: `${mobileParams2.dlonLeft}%`,
                        width: `${mobileParams2.dlonWidth}%`,
                      }
                    : {}),
                }}
              >
                <Image
                  src={getAssetPath('/assets/dlon-mobilna.png')}
                  alt=""
                  width={640}
                  height={410}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
                <canvas
                  ref={canvasRef}
                  className="ml-[1.25rem] absolute bottom-[1.2rem] left-[22rem] w-[14.5rem] hidden lg:block"
                  style={{
                    maskImage: `url("${getAssetPath('/assets/portfolios/maska.svg')}")`,
                    maskSize: '100% 100%',
                  }}
                  width={242}
                  height={397}
                />
              </div>

              <div
                className={`left-[-0.5rem] sm:left-[-1rem] lg:left-[-1.25rem] bottom-[6rem] sm:bottom-[8rem] lg:bottom-[10rem] absolute z-10 kwadrat-tyl ${isMobile ? (mobileParams2.showKwadratTyl ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showKwadratTyl
                    ? {
                        left: `${mobileParams2.kwadratTylLeft}%`,
                        bottom: `${mobileParams2.kwadratTylBottom}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/kwadrat-tyl.png')}
                  alt=""
                  width={36}
                  height={34}
                  className="w-auto h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <div
                className={`left-[-0.75rem] sm:left-[-1.25rem] lg:left-[-2.5rem] bottom-[5rem] sm:bottom-[7rem] lg:bottom-[9rem] absolute z-10 kwadrat-srodek ${isMobile ? (mobileParams2.showKwadratSrodek ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showKwadratSrodek
                    ? {
                        left: `${mobileParams2.kwadratSrodekLeft}%`,
                        bottom: `${mobileParams2.kwadratSrodekBottom}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/kwadrat-srodek.png')}
                  alt=""
                  width={53}
                  height={52}
                  className="w-[30px] sm:w-[40px] lg:w-auto h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
              <div
                className={`left-[-0.5rem] sm:left-[-0.75rem] lg:left-[-1.25rem] bottom-[4rem] sm:bottom-[6rem] lg:bottom-[8rem] absolute z-10 kwadrat-przod ${isMobile ? (mobileParams2.showKwadratPrzod ? '' : 'hidden') : 'hidden sm:block'}`}
                style={
                  isMobile && mobileParams2.showKwadratPrzod
                    ? {
                        left: `${mobileParams2.kwadratPrzodLeft}%`,
                        bottom: `${mobileParams2.kwadratPrzodBottom}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/kwadrat-przod.png')}
                  alt=""
                  width={82}
                  height={78}
                  className="w-auto h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MEDIA */}
      <div
        data-case-tile="3"
        className="flex justify-center gap-4 sm:gap-8 lg:gap-[10rem] h-auto lg:h-[45rem] -mt-[0.125rem] py-8 lg:py-0 px-4 overflow-visible"
      >
        <div className="flex border-4 sm:border-8 lg:border-[2.1875rem] w-full max-w-[90rem] lg:w-[80rem] rounded-2xl lg:rounded-[2rem] bg-[#fff] h-auto lg:h-[40rem] border-[#FFFFFF] relative overflow-visible">
          <div
            className="flex flex-col lg:flex-row w-[100%] rounded-xl lg:rounded-[1.5rem] overflow-visible"
            style={{ backgroundColor: 'rgb(242, 246, 249)' }}
          >
            <div className="relative z-10 w-full lg:w-[75%] px-6 sm:px-8 lg:pl-[3rem] py-8 lg:mt-[2rem] lg:py-0 flex flex-col justify-center order-1 lg:order-1">
              <div className="mb-[1rem] text-mini">MEDIA</div>
              <div className="font-roboto text-[clamp(24px,4vw,30px)] lg:text-[1.9rem] leading-[1.2] font-medium">
                Od pomysłu do lidera <br />
                immersyjnych technologii <br />
                video online — w 6 tygodni
              </div>
              <div className="flex items-center gap-[0.3rem] mb-[1.5rem] mt-[2rem] lg:mt-[3.5rem]">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <div className="text-[#4A495E] font-normal font-roboto text-[clamp(16px,2.5vw,20px)] lg:text-[1.3rem] pr-0 lg:pr-[1.5rem] leading-[1.2]">
                Wreszcie mamy narzędzie, które pokazuje prawdziwą jakość naszego
                projektu. Niespotykana dbałość o detale. Pełen profesjonalizm.
              </div>
              <div className="flex items-center gap-4 mt-[2rem] lg:mt-[4rem]">
                <div className="w-[2.3rem] h-[2.3rem]">
                  <Image
                    src={getAssetPath('/assets/vit.png')}
                    alt="Witalij Bińkowski"
                    width={37}
                    height={37}
                    className="w-full h-full object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="text-mini">Witalij Bińkowski</div>
                  <div className="text-[#90909D] text-mini">WŁAŚCICIEL</div>
                </div>
              </div>
            </div>
            <div
              style={{
                clipPath:
                  'polygon(-20% -20%, 110% -20%, 110% 100%, -20% 100%)',
                background:
                  'linear-gradient(0deg, rgb(12, 1, 43) 87%, rgb(40, 33, 73) 100%)',
              }}
              className="rounded-b-2xl lg:rounded-bl-[2rem] lg:rounded-tl-[8rem] relative w-full lg:w-[100%] aspect-square sm:aspect-auto h-auto sm:h-[500px] lg:h-[100%] order-2 lg:order-2 overflow-visible"
            >
              <div
                className="left-[50%] sm:left-[55%] lg:left-[27.5rem] w-[40%] sm:w-[35%] lg:w-[20rem] top-[4rem] sm:top-[6rem] lg:top-[8.5rem] absolute tlo-strony hidden sm:block"
                style={
                  isMobile
                    ? {
                        display: mobileParams3.showTlo ? 'block' : 'none',
                        left: `${mobileParams3.tloLeft}%`,
                        top: `${mobileParams3.tloTop}%`,
                        width: `${mobileParams3.tloWidth}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/tlo-strony.png')}
                  alt=""
                  width={320}
                  height={295}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className="w-[90%] sm:w-[80%] lg:w-[35rem] left-[5%] sm:left-[10%] lg:left-[4rem] rounded-t-[2rem] overflow-hidden top-[4rem] sm:top-[6rem] lg:top-[10rem] absolute eye-image"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams3.eyeLeft}%`,
                        width: `${mobileParams3.eyeWidth}%`,
                        top: `${mobileParams3.eyeTop}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath(
                    '/assets/projektowanie-strony-oko.jpg'
                  )}
                  alt=""
                  width={560}
                  height={289}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
                <div
                  className="left-[65%] sm:left-[70%] lg:left-[25.5rem] top-[3rem] sm:top-[5rem] lg:top-[7rem] w-[25%] sm:w-[20%] lg:w-[10rem] absolute hand-1 hidden sm:block"
                  style={
                    isMobile
                      ? {
                          display: mobileParams3.showHand1 ? 'block' : 'none',
                          left: `${mobileParams3.hand1Left}%`,
                          top: `${mobileParams3.hand1Top}%`,
                          width: `${mobileParams3.hand1Width}%`,
                        }
                      : undefined
                  }
                >
                  <Image
                    src={getAssetPath('/assets/dlon-artefakt.png')}
                    alt=""
                    width={160}
                    height={187}
                    className="w-full h-auto"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div
                  className="left-[60%] sm:left-[65%] lg:left-[25rem] w-[30%] sm:w-[25%] lg:w-[10rem] top-[6rem] sm:top-[9rem] lg:top-[13rem] absolute hand-2 hidden sm:block"
                  style={
                    isMobile
                      ? {
                          display: mobileParams3.showHand2 ? 'block' : 'none',
                          left: `${mobileParams3.hand2Left}%`,
                          top: `${mobileParams3.hand2Top}%`,
                          width: `${mobileParams3.hand2Width}%`,
                        }
                      : undefined
                  }
                >
                  <Image
                    src={getAssetPath(
                      '/assets/dlon-mobile-design.png'
                    )}
                    alt=""
                    width={160}
                    height={107}
                    className="w-full h-auto"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 21.5rem 8.5rem, rgba(11, 5, 44, 0) 100%, rgb(11, 5, 44) 200%)',
                  }}
                  className="absolute w-full h-full top-[0rem] hidden lg:block"
                />
              </div>

              <div
                className="w-[90%] sm:w-[80%] lg:w-[35rem] left-[5%] sm:left-[10%] lg:left-[4rem] top-[12rem] sm:top-[14rem] lg:top-[17rem] absolute"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams3.tlumLeft}%`,
                        width: `${mobileParams3.tlumWidth}%`,
                        top: `${mobileParams3.tlumTop}%`,
                      }
                    : undefined
                }
              >
                <Image
                  src={getAssetPath('/assets/tlum.png')}
                  alt=""
                  width={560}
                  height={115}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>

              <div
                className="w-[90%] sm:w-[80%] lg:w-[35rem] left-[5%] sm:left-[10%] lg:left-[4rem] top-[16rem] sm:top-[18rem] lg:top-[23rem] absolute"
                style={
                  isMobile
                    ? {
                        left: `${mobileParams3.hipnoLeft}%`,
                        width: `${mobileParams3.hipnoWidth}%`,
                        top: `${mobileParams3.hipnoTop}%`,
                      }
                    : undefined
                }
              >
                <div className="ml-[10%] sm:ml-[15%] lg:ml-[5rem] w-[70%] sm:w-[60%] lg:w-[25rem] h-[6rem] sm:h-[8rem] lg:h-[10rem] mt-[1rem] sm:mt-[1.5rem] lg:mt-[2rem]">
                  <Image
                    src={getAssetPath('/assets/hipnotyzuj.gif')}
                    alt=""
                    width={400}
                    height={114}
                    className="w-full h-auto"
                    unoptimized
                    loading="lazy"
                  />
                </div>
              </div>

              <div
                className="w-[70%] sm:w-[60%] lg:w-[27rem] left-[15%] sm:left-[20%] lg:left-[6.8rem] top-[12rem] sm:top-[14rem] lg:top-[16rem] absolute przyklady-strony hidden lg:block z-20"
                style={
                  isMobile
                    ? {
                        display: mobileParams3.showPrzyklady
                          ? 'block'
                          : 'none',
                        left: `${mobileParams3.przykladyLeft}%`,
                        top: `${mobileParams3.przykladyTop}%`,
                        width: `${mobileParams3.przykladyWidth}%`,
                        transform: 'scale(1.7, 1)',
                      }
                    : { transform: 'scale(1.7, 1)' }
                }
              >
                <Image
                  src={getAssetPath('/assets/przyklady-strony.png')}
                  alt=""
                  width={432}
                  height={213}
                  className="w-full h-auto"
                  unoptimized
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
