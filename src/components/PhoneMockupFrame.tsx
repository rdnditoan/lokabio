import React from 'react';

interface PhoneMockupFrameProps {
  children: React.ReactNode;
  screenHeightClass?: string;
}

export function PhoneMockupFrame({
  children,
  screenHeightClass = 'h-[540px] sm:h-[572px]',
}: PhoneMockupFrameProps) {
  return (
    <div className="relative mx-auto w-full max-w-[338px]">
      {/* Subtle hardware side buttons */}
      <span
        aria-hidden="true"
        className="hidden sm:block absolute -left-[2px] top-24 w-[3px] h-7 rounded-l bg-stone-700"
      />
      <span
        aria-hidden="true"
        className="hidden sm:block absolute -left-[2px] top-36 w-[3px] h-11 rounded-l bg-stone-700"
      />
      <span
        aria-hidden="true"
        className="hidden sm:block absolute -right-[2px] top-28 w-[3px] h-14 rounded-r bg-stone-700"
      />

      {/* Titanium-Dark Chassis */}
      <div className="rounded-[44px] p-[9px] bg-gradient-to-b from-stone-700 via-[#161614] to-stone-900 shadow-[0_28px_60px_-15px_rgba(20,20,19,0.34)] ring-1 ring-black/25">
        {/* Edge-to-edge Glass Screen */}
        <div
          className={`relative rounded-[35px] overflow-hidden bg-white ${screenHeightClass}`}
        >
          {/* Floating Dynamic Island */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 inset-x-0 z-20 flex justify-center"
          >
            <div className="w-[82px] h-[22px] rounded-full bg-[#111110] ring-1 ring-white/10 shadow-sm flex items-center justify-end pr-2">
              <span className="w-2 h-2 rounded-full bg-stone-800 ring-1 ring-stone-700/60" />
            </div>
          </div>

          {/* Scrollable Viewport with Hidden Scrollbar */}
          <div className="h-full w-full overflow-y-auto no-scrollbar overscroll-contain">
            {children}
          </div>

          {/* Subtle Bottom Home Gesture Pill */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 inset-x-0 z-20 flex justify-center"
          >
            <span className="w-24 h-1 rounded-full bg-current opacity-20 mix-blend-difference" />
          </div>
        </div>
      </div>
    </div>
  );
}
