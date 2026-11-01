/** The signed-out hero. Server-rendered and passed into HomeClient so the H1 is in the HTML before the app loads. */
export function HomeIntro() {
  return (
    <div className="auth-head">
      <span className="logo-icon">🌿</span>
      <h1>Meet people near you in Vidalia, GA over coffee, a walk, or a meal</h1>
      <p>
        <strong>Come as you are. Leave less alone.</strong> Simple moments of real presence — coffee,
        walks, meals, games — with people who choose acceptance over judgment.
      </p>
      <a className="found-link" href="/found">
        Found a coin? You are awesome.
      </a>
    </div>
  );
}
