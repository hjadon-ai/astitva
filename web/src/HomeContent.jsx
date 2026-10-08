import { ShieldCheck, ArrowRight } from 'lucide-react';
import { PageHeader, Surface } from './ui';
import { homeFeatures } from './homeFeatures';

function HomeImage({ name, alt, eager = false, className = '' }) {
  const square = name === 'family-connections' || name === 'family-everyday';
  const width = square ? 800 : 1280;
  const height = square ? 800 : name === 'family-together' ? 720 : 853;
  return <img className={`home-art ${className}`} src={`/images/home/${name}-${width}.webp`} srcSet={`/images/home/${name}-${square ? 400 : 640}.webp ${square ? 400 : 640}w, /images/home/${name}-${width}.webp ${width}w`} sizes={square ? '(max-width: 760px) 90vw, 380px' : '(max-width: 760px) 92vw, (max-width: 1200px) 55vw, 720px'} width={width} height={height} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" />;
}

export function FamilyIllustration() {
  return <div className="home-illustration" aria-label="Family connection and sharing illustration">
    <HomeImage name="family-connections" alt="Illustrated family tree connecting grandparents, parents and children." />
    <div className="home-illustration-copy"><strong>Connect as a family.</strong><span>Accept invitations. Choose what to share.</span><small>Your personal information stays private unless you share it.</small></div>
  </div>;
}
export function PublicHomeIntro() {
  return <><p className="eyebrow">Family, thoughtfully connected</p><h1>A private space <em>for your family.</em></h1><p className="lede">Bring your family relationships and everyday life together. Stay connected, manage what matters, and choose what you share.</p><HomeImage name="family-together" alt="Illustrated family of three generations spending time together outdoors." eager className="home-hero-art"/></>;
}
export function PublicHomeSections({ runtime }) {
  return <><section id="families" className="content-section"><div className="section-heading"><p className="eyebrow">Together, with choice</p><h2>Your family. Your everyday life.</h2></div>
    <div className="home-benefits"><Surface><HomeImage name="family-connections" alt="Illustrated relationships across three generations."/><h3>Family connections</h3><p>Build your family relationships and invite members to accept their place in the family.</p></Surface><Surface><HomeImage name="family-everyday" alt="Illustrated grandparents, parents and children enjoying shared everyday moments."/><h3>Everyday management</h3><p>Keep priorities, meals and finances organized with the tools enabled for your account.</p></Surface><Surface><ShieldCheck aria-hidden="true"/><h3>Sharing you control</h3><p>Family membership does not automatically share private data. Choose who can view your Diet or Finance information.</p></Surface></div>
  </section><section id="privacy" className="content-section home-privacy"><div><p className="eyebrow">Private by choice</p><h2>Connection starts with consent.</h2></div><div><p>A family invitation connects an account only after it is accepted. Sharing is optional and can be revoked.</p>{runtime?.environment==='production' && <p>Production signup requires an invitation. Use the invited email address when creating your account.</p>}</div></section><section className="content-section home-vision"><div className="section-heading"><p className="eyebrow">Looking ahead</p><h2>More happy days, together.</h2><p>A vision for family life. The concept below includes ideas for future features, not a list of everything available today.</p></div><figure><HomeImage name="family-vision" alt="Future family-life concept with labels for events, planning, responsibilities, memories and staying connected."/><figcaption>Concept illustration. Events, shared responsibilities and photo memories are future ideas; availability follows each feature's approval and release.</figcaption></figure></section></>;
}
export default function SignedInHome({ user, runtime }) {
  const access=homeFeatures(user.features,runtime);
  return <section className="profile-content" id="profile">
    <PageHeader eyebrow="Workspace / Home" title={`Welcome, ${user.name}.`} description="A place for your family and the everyday things that matter."/>
    <Surface className="profile-card"><div><p className="eyebrow">Your account</p><h2>{user.name}</h2><p>{user.email}</p></div><span>Signed in</span></Surface>
    {access.family && <Surface className="home-family-card"><div><p className="eyebrow">Your family</p><h2>Keep your family connected.</h2><p>Manage members, invitations and the information you choose to share.</p><a className="button button-primary" href="#family">Open Family <ArrowRight size={18} aria-hidden="true"/></a></div><FamilyIllustration/></Surface>}
    {access.tools.length>0 && <section aria-labelledby="home-tools-title"><h2 id="home-tools-title">Your everyday tools</h2><div className="home-tools">{access.tools.map(tool=><Surface key={tool.id}><h3>{tool.title}</h3><p>{tool.description}</p>{tool.available?<a className="button button-secondary" href={`#${tool.id}`}>Open {tool.title}</a>:<p className="home-unavailable">{runtime?.financeProvider?.enabled===false?'Finance is unavailable in this environment.':'Finance availability could not be confirmed. Try refreshing.'}</p>}</Surface>)}</div></section>}
    {!access.family && access.tools.length===0 && <Surface><h2>Your account is ready.</h2><p>No Home destinations are enabled for your account. Feature access is managed by the application administrator.</p></Surface>}
  </section>;
}
