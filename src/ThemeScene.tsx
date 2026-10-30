export function ThemeScene({ palette }: { palette: string }) {
  return <div className={`theme-scene scene-${palette}`} aria-hidden="true">
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="scene-fade" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".02"/><stop offset="1" stopColor="currentColor" stopOpacity=".35"/></linearGradient>
      </defs>
      {palette === 'forest' ? <>
        <circle className="scene-orb" cx="920" cy="150" r="65" fill="currentColor" opacity=".15"/>
        {[60,170,300,440,610,770,920,1080,1180].map((x,i) => <g key={x} transform={`translate(${x} ${170 + (i%3)*50}) scale(${.7+(i%3)*.2})`} opacity={.15+(i%3)*.1}><path d="M0 0L-55 110H-30L-80 200H-40L-105 290H105L40 200H80L30 110H55Z" fill="currentColor"/><path d="M-8 270H8V440H-8Z" fill="currentColor"/></g>)}
        <path className="scene-mist" d="M-100 460Q200 340 550 460T1400 440V600H-100Z" fill="currentColor" opacity=".13"/>
      </> : palette === 'sunset' || palette === 'desert' ? <>
        <circle className="scene-orb" cx="900" cy="250" r="100" fill="currentColor" opacity=".4"/>
        <circle cx="900" cy="250" r="125" fill="none" stroke="currentColor" opacity=".12"/>
        <path d="M0 470Q250 270 540 460T1200 370V600H0Z" fill="currentColor" opacity=".16"/>
        <path d="M0 510Q400 340 700 500T1200 450V600H0Z" fill="currentColor" opacity=".25"/>
        {palette === 'desert' && <path d="M1010 540V420M1010 470H985V440M1010 490H1037V452" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" opacity=".45"/>}
      </> : palette === 'midnight' ? <>
        <circle className="scene-orb" cx="960" cy="140" r="62" fill="currentColor" opacity=".28"/>
        {Array.from({length:36},(_,i)=><circle className="scene-star" key={i} cx={(i*173+37)%1200} cy={(i*97+23)%420} r={i%3+1} fill="currentColor" style={{animationDelay:`${i%7}s`}}/>)}
        <path d="M0 600L210 390L350 480L600 300L810 490L1020 360L1200 540V600Z" fill="currentColor" opacity=".12"/>
      </> : palette === 'ocean' ? <>
        {[0,1,2].map(i=><path className="scene-mist" key={i} d={`M-100 ${390+i*65}Q150 ${270+i*65} 400 ${390+i*65}T900 ${390+i*65}T1400 ${390+i*65}V650H-100Z`} fill="currentColor" opacity={.08+i*.06}/>)}
      </> : <>
        {[0,1,2,3].map(i=><ellipse className="scene-mist" key={i} cx={820+i*90} cy={290+i*55} rx="210" ry="95" transform={`rotate(${-35+i*20} ${820+i*90} ${290+i*55})`} fill="url(#scene-fade)"/>)}
      </>}
    </svg>
  </div>
}
