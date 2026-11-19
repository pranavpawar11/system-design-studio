import { useEffect, useRef, useState } from 'react';
import { Database, Network, Server, ShieldCheck, Workflow } from 'lucide-react';

type Stage = 'architecture' | 'service' | 'classes' | 'code';
type Language = 'java' | 'cpp' | 'python';

const stages: { id: Stage; number: string; eyebrow: string; title: string; body: string }[] = [
  { id: 'architecture', number: '01', eyebrow: 'HIGH-LEVEL DESIGN', title: 'Start with the whole system.', body: 'Trace a request from the client through the gateway and rate-limiting service to shared state. Think about boundaries, traffic and failure points.' },
  { id: 'service', number: '02', eyebrow: 'SERVICE DESIGN', title: 'Open the service boundary.', body: 'Zoom into the rate limiter. Separate request validation, policy selection, token accounting and Redis-backed state into clear responsibilities.' },
  { id: 'classes', number: '03', eyebrow: 'LOW-LEVEL DESIGN', title: 'Model the objects and their roles.', body: 'Give each responsibility a home. Explore how RateLimiter coordinates a RequestPolicy and TokenBucket without mixing orchestration and token logic.' },
  { id: 'code', number: '04', eyebrow: 'IMPLEMENTATION', title: 'Turn the design into code.', body: 'See how the same design can be expressed in Java, C++ or Python, while respecting the idioms of each language.' },
];

const samples: Record<Language, string> = {
  java: 'class TokenBucket {\n  boolean consume(int tokens) {\n    if (available >= tokens) {\n      available -= tokens;\n      return true;\n    }\n    return false;\n  }\n}',
  cpp: 'class TokenBucket {\npublic:\n  bool consume(int tokens) {\n    if (available >= tokens) {\n      available -= tokens;\n      return true;\n    }\n    return false;\n  }\n};',
  python: 'class TokenBucket:\n    def consume(self, tokens):\n        if self.available >= tokens:\n            self.available -= tokens\n            return True\n        return False',
};

function ArchitectureVisual() {
  return <div className="macro-visual-stage macro-architecture">
    <div className="macro-flow-node"><Network/><b>Client</b></div><i className="macro-flow-line"/><div className="macro-flow-node"><Server/><b>API Gateway</b></div><i className="macro-flow-line"/><div className="macro-flow-node macro-focus"><ShieldCheck/><b>Rate Limiter</b></div><i className="macro-flow-line"/><div className="macro-flow-node"><Database/><b>Redis</b></div>
    <div className="macro-visual-caption">REQUEST FLOW · DISTRIBUTED BOUNDARIES</div>
  </div>;
}
function ServiceVisual() {
  return <div className="macro-visual-stage macro-service">
    <div className="macro-service-core"><ShieldCheck/><b>Rate Limiter Service</b></div>
    <div className="macro-service-grid"><span>Request validation</span><span>Policy selection</span><span>Token accounting</span><span>State adapter</span></div>
    <div className="macro-visual-caption">SERVICE RESPONSIBILITIES · DEPENDENCIES</div>
  </div>;
}
function ClassVisual() {
  return <div className="macro-visual-stage macro-uml">
    <div className="macro-uml-box macro-uml-main"><b>RateLimiter</b><span>+ allowRequest()</span><span>- policy</span></div>
    <div className="macro-uml-connectors"><i/><i/></div>
    <div className="macro-uml-row"><div className="macro-uml-box"><b>RequestPolicy</b><span>+ limit()</span></div><div className="macro-uml-box"><b>TokenBucket</b><span>+ consume()</span><span>+ refill()</span></div></div>
    <div className="macro-visual-caption">CLASS RELATIONSHIPS · RESPONSIBILITY</div>
  </div>;
}
function CodeVisual({ language, setLanguage }: { language: Language; setLanguage: (value: Language) => void }) {
  return <div className="macro-visual-stage macro-code">
    <div className="macro-code-toolbar"><span>TokenBucket</span><select aria-label="Implementation language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="java">Java</option><option value="cpp">C++</option><option value="python">Python</option></select></div>
    <pre><code>{samples[language]}</code></pre>
    <div className="macro-code-callout"><Workflow size={14}/> consume(tokens) · token decision</div>
    <div className="macro-visual-caption">LANGUAGE-SPECIFIC IMPLEMENTATION</div>
  </div>;
}

export default function MacroToMicroJourney() {
  const [active, setActive] = useState<Stage>('architecture');
  const [language, setLanguage] = useState<Language>('java');
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const elements = stepRefs.current.filter(Boolean) as HTMLElement[];
    if (!('IntersectionObserver' in window) || elements.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target instanceof HTMLElement) {
        const stage = visible.target.dataset.stage as Stage | undefined;
        if (stage) setActive(stage);
      }
    }, { rootMargin: '-28% 0px -38% 0px', threshold: [0.1, 0.25, 0.5, 0.75] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const goTo = (stage: Stage) => {
    setActive(stage);
    stepRefs.current[stages.findIndex((item) => item.id === stage)]?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  return <section className="macro-journey" aria-labelledby="macro-journey-title">
    <div className="section-heading macro-journey-heading"><span>FROM MACRO TO MICRO</span><h2 id="macro-journey-title">Follow one engineering problem all the way down.</h2><p>Scroll through the same Rate Limiter as it moves from distributed architecture to service responsibilities, object design and implementation.</p></div>
    <div className="macro-journey-layout">
      <div className="macro-journey-visual-wrap">
        <div className="macro-journey-visual" aria-live="polite">
          <div className="macro-journey-visual-head"><span>RATE LIMITER / DESIGN EXPLORER</span><span>{stages.find((item) => item.id === active)?.number} / 04</span></div>
          <div className={`macro-visual-transition stage-${active}`} key={active}>
            {active === 'architecture' ? <ArchitectureVisual/> : active === 'service' ? <ServiceVisual/> : active === 'classes' ? <ClassVisual/> : <CodeVisual language={language} setLanguage={setLanguage}/>}
          </div>
          <div className="macro-stage-tabs" aria-label="Journey stages">
            {stages.map((stage) => <button key={stage.id} type="button" className={active === stage.id ? 'is-active' : ''} aria-current={active === stage.id ? 'step' : undefined} onClick={() => goTo(stage.id)}>{stage.number}</button>)}
          </div>
        </div>
      </div>
      <div className="macro-journey-steps">
        {stages.map((stage, index) => <article key={stage.id} ref={(element) => { stepRefs.current[index] = element; }} data-stage={stage.id} className={`macro-journey-step ${active === stage.id ? 'is-active' : ''}`}>
          <span className="macro-step-index">{stage.number} / 04</span><small>{stage.eyebrow}</small><h3>{stage.title}</h3><p>{stage.body}</p>
          <button type="button" onClick={() => goTo(stage.id)} aria-label={`Explore stage ${stage.number}: ${stage.title}`}>Explore stage <span aria-hidden>→</span></button>
        </article>)}
      </div>
    </div>
  </section>;
}
