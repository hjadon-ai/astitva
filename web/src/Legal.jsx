const contact = 'hjadon27@gmail.com';

function LegalLayout({ title, children }) {
  return (
    <>
      <header className="site-header shell">
        <a className="brand" href="/">Astitva<span>.</span></a>
        <nav aria-label="Legal navigation"><a href="/">Home</a></nav>
      </header>
      <main className="legal-page shell">
        <p className="eyebrow">Astitva / Legal</p>
        <h1>{title}</h1>
        <p className="legal-updated">Draft for review · September 30, 2026</p>
        {children}
      </main>
      <footer className="site-footer shell">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/">Home</a>
      </footer>
    </>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy policy">
      <p>Astitva is a private personal workspace. This page explains the information the application uses to provide accounts, daily priorities, diet tracking, and optional finance features.</p>

      <h2>Information you provide</h2>
      <p>When you create an account, Astitva stores your name, email address, a password hash, and account verification status. It stores the priorities, diet entries, and other workspace content you choose to enter.</p>
      <p>If you connect a financial institution through Plaid, Astitva stores connection details, encrypted access credentials, and the account, balance, transaction, and holding information needed to show the finance feature. The finance feature is available only when enabled.</p>

      <h2>How information is used</h2>
      <p>Astitva uses account information to authenticate you, protect your account, send verification and password reset messages, and operate the features you use. It uses a session cookie to keep you signed in. Verification and reset links expire.</p>

      <h2>Google and Gmail data</h2>
      <p>Astitva has access to the owner’s Gmail account solely through the Gmail send permission. It uses that access to send account verification and password reset messages from the owner’s address. Astitva does not request permission to read the Gmail inbox or the recipients’ Google accounts. The Gmail OAuth credentials are held by the server and are not sent to the web browser.</p>

      <h2>Service providers</h2>
      <p>Firebase Hosting serves the web application, Render runs the server, and MongoDB Atlas stores production application data. Google processes the outgoing Gmail messages. Plaid processes financial connections when that feature is enabled and you choose to connect an institution. These providers may process information needed to deliver their respective services.</p>

      <h2>Storage and control</h2>
      <p>Account and workspace information remains stored while the account is active. Short lived verification, reset, and session records expire. To request access to or deletion of your account data, email <a href={`mailto:${contact}`}>{contact}</a>. Disconnecting a financial institution stops future access through that connection; contact us if you also want previously synchronized data deleted.</p>

      <h2>Changes and questions</h2>
      <p>We may update this page as Astitva changes. The current version will appear here. For privacy questions, contact <a href={`mailto:${contact}`}>{contact}</a>.</p>
    </LegalLayout>
  );
}

export function TermsOfService() {
  return (
    <LegalLayout title="Terms of service">
      <p>Astitva is an invitation based personal workspace. By creating an account or using the application, you agree to use it lawfully and to provide accurate account information.</p>

      <h2>Your account</h2>
      <p>Keep your password and account access secure. You are responsible for activity through your account. You may contact <a href={`mailto:${contact}`}>{contact}</a> to request help with access or account deletion.</p>

      <h2>Your content</h2>
      <p>You remain responsible for information you enter into Astitva. You grant Astitva permission to store and process that information only as needed to operate the application and the features you choose to use.</p>

      <h2>Finance information</h2>
      <p>If finance features are available, account and transaction information is provided for personal organization. It may be delayed or incomplete. Astitva does not provide financial, investment, tax, or legal advice. Check important figures with your financial institution.</p>

      <h2>Availability and changes</h2>
      <p>We may maintain, change, or discontinue features and may restrict access when needed to protect the service. We may update these terms; the current version will appear here.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent to <a href={`mailto:${contact}`}>{contact}</a>.</p>
    </LegalLayout>
  );
}
