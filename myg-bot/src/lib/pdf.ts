<!-- src/templates/factions/report.html -->
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Rapport de Faction – {{name}}</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
      }

      body {
        background: radial-gradient(circle at top, #1f3b64 0, #050814 55%, #000 100%);
        color: #f5f8ff;
        padding: 32px;
      }

      .card {
        width: 1200px;
        margin: 0 auto;
        border-radius: 24px;
        background: linear-gradient(145deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.96));
        box-shadow: 0 34px 80px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.3);
        position: relative;
      }

      .banner {
        position: relative;
        height: 260px;
        overflow: hidden;
      }

      .banner img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: saturate(1.1) contrast(1.1);
        transform: scale(1.02);
      }

      .banner-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          rgba(15, 23, 42, 0.1),
          rgba(15, 23, 42, 0.9)
        );
      }

      .banner-title {
        position: absolute;
        left: 32px;
        bottom: 24px;
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .logo {
        width: 80px;
        height: 80px;
        border-radius: 999px;
        border: 2px solid rgba(191, 219, 254, 0.9);
        overflow: hidden;
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.7);
        background: #020617;
      }

      .logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .title-text h1 {
        font-size: 32px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .title-text span {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        color: #bae6fd;
      }

      .meta {
        display: flex;
        justify-content: space-between;
        padding: 24px 32px 8px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.35);
      }

      .meta-left {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .pill-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .pill {
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.55);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #e5e7eb;
      }

      .level {
        font-size: 20px;
        font-weight: 600;
        color: #e0f2fe;
      }

      .meta-right {
        text-align: right;
      }

      .big-score {
        font-size: 32px;
        font-weight: 700;
        color: #bfdbfe;
      }

      .muted {
        font-size: 12px;
        color: #9ca3af;
      }

      .content {
        display: grid;
        grid-template-columns: 2fr 1.5fr;
        gap: 20px;
        padding: 20px 32px 28px;
      }

      .section {
        background: radial-gradient(
          circle at top left,
          rgba(59, 130, 246, 0.22),
          rgba(15, 23, 42, 0.7)
        );
        border-radius: 20px;
        padding: 16px 18px;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }

      .section h2 {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #bfdbfe;
        margin-bottom: 10px;
      }

      .summary {
        font-size: 14px;
        color: #e5e7eb;
        line-height: 1.5;
      }

      .members {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 6px;
      }

      .member-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: #e5e7eb;
      }

      .member-row span.role {
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.14em;
        color: #a5b4fc;
      }

      .footer {
        padding: 0 32px 22px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #9ca3af;
      }

      .accent {
        color: #7dd3fc;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="banner">
        <img src="{{bannerUrl}}" alt="Bannière de faction" />
        <div class="banner-gradient"></div>

        <div class="banner-title">
          <div class="logo">
            <img src="{{logoUrl}}" alt="Logo MYG" />
          </div>
          <div class="title-text">
            <span>MYG FACTIONS</span>
            <h1>{{name}}</h1>
          </div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-left">
          <div class="pill-row">
            <div class="pill">Inhouse league</div>
            <div class="pill">Faction active</div>
            <div class="pill">Saison {{season}}</div>
          </div>
          <div class="level">Niveau {{level}} • {{progress}}% vers le prochain palier</div>
        </div>

        <div class="meta-right">
          <div class="big-score">{{score}} pts</div>
          <div class="muted">Score total de faction</div>
        </div>
      </div>

      <div class="content">
        <div class="section">
          <h2>Résumé</h2>
          <p class="summary">{{summary}}</p>

          <div style="margin-top: 14px">
            <span class="muted"
              >Membres actifs : <span class="accent">{{membersCount}}</span></span
            >
            <br />
            <span class="muted"
              >Winrate estimé en inhouse : <span class="accent">{{winrate}}</span></span
            >
          </div>
        </div>

        <div class="section">
          <h2>Line-up actuelle</h2>
          <div class="members">
            {{membersHtml}}
          </div>
        </div>
      </div>

      <div class="footer">
        <span>Généré par <span class="accent">MYG Golem</span></span>
        <span>Rapport debug • {{generatedAt}}</span>
      </div>
    </div>
  </body>
</html>
